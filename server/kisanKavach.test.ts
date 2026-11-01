import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { districtFixtures } from "./data/gisFixtures";
import { buildClaimDossierPdf } from "./dossierPdf";
import { assessedPlotsForDistrict, calculateParcelInundation, dashboardSnapshot, getClaimExport, matchCadastral, processFlood, receiveSmsReply, resetDemoWorkflow, sendIntimation } from "./gisAnalytics";

describe("KISAN KAVACH fixture-backed GIS workflow", () => {
  beforeAll(() => vi.useFakeTimers({ now: new Date("2026-08-17T10:00:00.000Z") }));
  afterAll(() => vi.useRealTimers());
  it("caps all calculated inundation at the Turf-derived parcel geometry area", () => {
    for (const district of ["dhubri", "darbhanga"] as const) {
      const plots = assessedPlotsForDistrict(district);
      expect(plots.length).toBeGreaterThan(0);
      plots.forEach((plot) => {
        expect(plot.trueInundatedHa).toBeLessThanOrEqual(plot.areaHa);
        expect(plot.overlapPct).toBeLessThanOrEqual(100);
        expect(plot.overlapPct).toBeGreaterThanOrEqual(0);
        expect(plot.overlapPct).toBe(Number(((plot.trueInundatedHa / plot.areaHa) * 100).toFixed(1)));
      });
    }
  });

  it("enforces the area cap when a flood footprint fully contains a parcel geometry", () => {
    const fixture = districtFixtures.dhubri;
    const original = fixture.parcels[0];
    const coveringFlood = {
      ...fixture.floodLayers[0],
      geometry: {
        type: "MultiPolygon" as const,
        coordinates: [[[[89.95, 26.01], [89.98, 26.01], [89.98, 26.03], [89.95, 26.03], [89.95, 26.01]]]],
      },
    };
    const result = calculateParcelInundation(original, [coveringFlood]);

    expect(result.intersectedAreaHa).toBe(result.parcelTotalHa);
    expect(result.trueInundatedHa).toBe(result.parcelTotalHa);
    expect(result.lossPercentage).toBe(100);
  });

  it("switches the analytical workspace between Dhubri and Darbhanga", () => {
    const dhubri = dashboardSnapshot("dhubri");
    const darbhanga = dashboardSnapshot("darbhanga");

    expect(dhubri.jurisdiction).toMatchObject({ state: "Assam", district: "Dhubri", key: "dhubri" });
    expect(darbhanga.jurisdiction).toMatchObject({ state: "Bihar", district: "Darbhanga", key: "darbhanga" });
    expect(dhubri.center.longitude).not.toBe(darbhanga.center.longitude);
    expect(dhubri.plots.every((plot) => plot.district === "Dhubri")).toBe(true);
    expect(darbhanga.plots.every((plot) => plot.district === "Darbhanga")).toBe(true);
  });

  it("records SAR threshold metadata and returns dynamically matched claim data", () => {
    const result = processFlood([89.956, 26.014, 89.976, 26.019], "dhubri");
    const matches = matchCadastral("dhubri");

    expect(result.processor.thresholdMethods).toContain("Otsu adaptive thresholding");
    expect(result.processor.appliedThresholdDb).toBe(-18);
    expect(result.geojson.features[0]?.geometry.type).toBe("MultiPolygon");
    expect(matches.claims.every((claim) => claim.trueInundatedHa <= claim.areaHa)).toBe(true);
  });

  it("seals only reply 1 for PMFBY and exposes the calculated assessment in the payload", () => {
    const claimId = assessedPlotsForDistrict("darbhanga")[0].claimId;
    sendIntimation(claimId);
    const reply = receiveSmsReply(claimId, "1");
    const payload = getClaimExport(claimId);

    expect(reply.accepted).toBe(true);
    expect(reply.claim.claimStatus).toBe("SEALED_FOR_PMFBY");
    expect(reply.claim.consentToken).toMatch(/^PMFBY-CNS-/);
    expect(payload.assessment.trueInundatedHa).toBeLessThanOrEqual(payload.cadastral.totalAreaHa);
    expect(payload.dataClassification).toContain("Representative GIS fixture");
    expect(payload.cadastral.ulpin).toMatch(/^\d{14}$/);
    expect(payload.financialAssessment.indicativePayoutInr).toBeGreaterThanOrEqual(0);
    expect(payload.assessment.provenance.evidence.localFloodFixtureSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.statutoryAudit.sarAcquisitionTimestamp).toBe("2026-08-16T19:38:00.000Z");
    expect(Number.isFinite(Date.parse(payload.statutoryAudit.smsDispatchTimestamp))).toBe(true);
    expect(Date.parse(payload.statutoryAudit.smsDispatchTimestamp)).toBeGreaterThan(Date.parse(payload.statutoryAudit.sarAcquisitionTimestamp));
    expect(payload.statutoryAudit.rainfallTelemetry.cumulative72hMm).toBe(148.5);
  });

  it("keeps an unrecognized reply pending and records an explicit decline", () => {
    const claimId = assessedPlotsForDistrict("dhubri")[2].claimId;
    sendIntimation(claimId);

    const unrecognized = receiveSmsReply(claimId, "hello");
    expect(unrecognized.accepted).toBe(false);
    expect(unrecognized.claim.claimStatus).toBe("PENDING_CONSENT");

    const declined = receiveSmsReply(claimId, "0");
    expect(declined.accepted).toBe(false);
    expect(declined.claim.claimStatus).toBe("DECLINED");
  });

  it("reopens the simulated 72-hour window for judge demos", () => {
    const resetAt = new Date("2026-08-24T06:15:00.000Z");
    vi.setSystemTime(resetAt);
    const selectedClaimId = assessedPlotsForDistrict("dhubri")[0].claimId;
    const result = resetDemoWorkflow(selectedClaimId, resetAt);
    const plot = assessedPlotsForDistrict("dhubri")[0];

    expect(result.remainingSeconds).toBe(72 * 60 * 60);
    expect(result.deadlineAt).toBe("2026-08-27T06:15:00.000Z");
    expect(result.selectedClaimId).toBe(selectedClaimId);
    expect(result.selectedClaimStatus).toBe("PENDING_CONSENT");
    expect(plot.claimStatus).toBe("PENDING_CONSENT");
    expect(plot.sla.remainingSeconds).toBe(72 * 60 * 60);
  });

  it("creates a structured PDF dossier with registry, assessment, and safety sections", () => {
    const claimId = assessedPlotsForDistrict("dhubri")[0].claimId;
    const pdf = buildClaimDossierPdf(claimId).toString("utf8");

    expect(pdf).toContain("%PDF-1.4");
    expect(pdf).toContain("CLAIM REGISTRY & CADASTRAL IDENTIFICATION");
    expect(pdf).toContain("GEO-SPATIAL FLOOD ASSESSMENT");
    expect(pdf).toContain("AREA SAFETY & FINANCIAL STATUS");
    expect(pdf).toContain("ULPIN-style identifier");
    expect(pdf).toContain("SAR acquisition:");
    expect(pdf).toContain("IMD/ERA5 telemetry: 148.5 mm");
  });
});
