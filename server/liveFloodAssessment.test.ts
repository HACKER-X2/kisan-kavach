import { describe, expect, it } from "vitest";
import { calculateLiveFloodAssessment } from "../client/src/components/liveFloodAssessment";
import { getSpectralSummary } from "../client/src/components/spectralModel";
import { dashboardSnapshot } from "./gisAnalytics";

describe("live selected-parcel flood assessment", () => {
  const snapshot = dashboardSnapshot("dhubri");
  const floodGeoJson = snapshot.floodGeoJson;

  it("uses the geometry shown by Leaflet and ignores stale assessed area fields", () => {
    const plot = snapshot.plots.find((candidate) => candidate.khasraNo === "413/1");
    expect(plot).toBeDefined();
    const assessment = calculateLiveFloodAssessment({ ...plot!, areaHa: 999, intersectedAreaHa: 999, trueInundatedHa: 999, overlapPct: 99 }, floodGeoJson);

    expect(assessment).not.toBeNull();
    expect(assessment!.parcelTotalHa).toBeGreaterThan(0);
    expect(assessment!.trueInundatedHa).toBeLessThanOrEqual(assessment!.parcelTotalHa);
    expect(assessment!.lossPercentage).toBe(Number(((assessment!.trueInundatedHa / assessment!.parcelTotalHa) * 100).toFixed(1)));
    expect(assessment!.lossPercentage).not.toBe(99);
    expect(assessment!.lossPercentage).toBeGreaterThanOrEqual(18);
    expect(assessment!.lossPercentage).toBeLessThanOrEqual(20);
    expect(plot!.trueInundatedHa).toBe(assessment!.trueInundatedHa);
    expect(plot!.overlapPct).toBe(assessment!.lossPercentage);
  });

  it("keeps the spectral summary synchronized with the same live assessment", () => {
    const partialPlot = snapshot.plots.find((candidate) => {
      const assessment = calculateLiveFloodAssessment(candidate, floodGeoJson);
      return assessment && assessment.lossPercentage > 0 && assessment.lossPercentage < 100;
    });
    expect(partialPlot).toBeDefined();

    const assessment = calculateLiveFloodAssessment(partialPlot!, floodGeoJson)!;
    const summary = getSpectralSummary(assessment);
    expect(summary).toMatchObject({
      submergedAreaHa: assessment.trueInundatedHa,
      cadastralAreaHa: assessment.parcelTotalHa,
      lossPercentage: assessment.lossPercentage,
      thresholdExceeded: assessment.lossPercentage >= 20,
    });
  });

  it("reports zero loss when the selected parcel does not intersect the active flood mask", () => {
    const dryPlot = snapshot.plots.find((candidate) => calculateLiveFloodAssessment(candidate, floodGeoJson)?.lossPercentage === 0);
    expect(dryPlot).toBeDefined();
    const assessment = calculateLiveFloodAssessment(dryPlot!, floodGeoJson)!;
    expect(assessment).toMatchObject({ intersectedAreaHa: 0, trueInundatedHa: 0, lossPercentage: 0, thresholdExceeded: false });
  });
});
