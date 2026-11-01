import { describe, expect, it } from "vitest";
import { calculateTurfFloodAssessment, getSentinel1PostFloodLayer, getSentinel2PreFloodLayer } from "../client/src/services/wmsService";

const parcel: GeoJSON.Polygon = { type: "Polygon", coordinates: [[[89.96, 26.01], [89.964, 26.01], [89.964, 26.014], [89.96, 26.014], [89.96, 26.01]]] };
const flood: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, GeoJSON.GeoJsonProperties> = {
  type: "FeatureCollection",
  features: [{ type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: [[[[89.962, 26.01], [89.966, 26.01], [89.966, 26.014], [89.962, 26.014], [89.962, 26.01]]]] } }],
};

describe("WMS service zero-credential mode", () => {
  it("retains Esri imagery fallback for both spectral date layers", () => {
    expect(getSentinel2PreFloodLayer("2026-07-18", "2026-07-18").isFallback).toBe(true);
    expect(getSentinel1PostFloodLayer("2026-08-06", "2026-08-06").isFallback).toBe(true);
  });

  it("caps the Turf intersection at the source parcel area", () => {
    const result = calculateTurfFloodAssessment(parcel, flood);
    expect(result).not.toBeNull();
    expect(result!.trueInundatedHa).toBeLessThanOrEqual(result!.parcelTotalHa);
    expect(result!.lossPercentage).toBeGreaterThan(45);
    expect(result!.lossPercentage).toBeLessThan(55);
  });
});
