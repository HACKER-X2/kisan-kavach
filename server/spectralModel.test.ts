import { describe, expect, it } from "vitest";
import { dashboardSnapshot } from "./gisAnalytics";
import { calculateLiveFloodAssessment } from "../client/src/components/liveFloodAssessment";
import { DEFAULT_SPECTRAL_KHASRA, getBeforeRevealWidth, getParcelCentroid, getSpectralMetadata, getSpectralSummary, normalizeRevealPercent, PMFBY_INTIMATION_THRESHOLD, selectInitialSpectralPlotId } from "../client/src/components/spectralModel";

describe("spectral comparison model", () => {
  const snapshot = dashboardSnapshot("dhubri");
  const plot = snapshot.plots.find((item) => item.khasraNo === "413/1");
  const assessment = calculateLiveFloodAssessment(plot ?? null, snapshot.floodGeoJson);

  it("derives a geographic centroid from the selected Khasra polygon", () => {
    expect(plot).toBeDefined();
    expect(getParcelCentroid(plot ?? null)).toEqual({
      latitude: 26.016125,
      longitude: 89.9624,
    });
  });

  it("uses Khasra #413/1 as the Dhubri comparison target and exposes its dynamic parcel metadata", () => {
    const metadata = getSpectralMetadata(plot ?? null, assessment);
    expect(DEFAULT_SPECTRAL_KHASRA).toBe("413/1");
    expect(selectInitialSpectralPlotId(snapshot.plots)).toBe(plot?.id);
    expect(metadata).toMatchObject({
      location: "Khasra #413/1 · Golakganj Block, Dhubri District, Assam (Brahmaputra Basin)",
      cadastralAreaHa: assessment?.parcelTotalHa,
    });
  });

  it("uses the shared live Turf intersection and the PMFBY threshold for the loss summary", () => {
    const summary = getSpectralSummary(assessment);
    expect(summary).toMatchObject({
      submergedAreaHa: assessment?.trueInundatedHa,
      cadastralAreaHa: assessment?.parcelTotalHa,
      lossPercentage: assessment?.lossPercentage,
      thresholdExceeded: (assessment?.lossPercentage ?? 0) >= PMFBY_INTIMATION_THRESHOLD,
    });
    expect(summary?.submergedAreaHa).toBeLessThanOrEqual(summary?.cadastralAreaHa ?? 0);
  });

  it("clamps and scales the before-image reveal for the accessible split slider", () => {
    expect(normalizeRevealPercent(0)).toBe(8);
    expect(normalizeRevealPercent(100)).toBe(92);
    expect(getBeforeRevealWidth(52)).toEqual({ revealPercent: 52, innerWidthPercent: 192.30769230769232 });
  });
});
