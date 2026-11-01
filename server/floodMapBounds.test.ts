import { describe, expect, it } from "vitest";
import { deriveDistrictBounds } from "../client/src/components/floodMapBounds";
import { districtFixtures } from "./data/gisFixtures";

function getFixtureBounds(district: keyof typeof districtFixtures) {
  const fixture = districtFixtures[district];
  return deriveDistrictBounds([...fixture.floodLayers.map((feature) => feature.geometry), ...fixture.parcels.map((feature) => feature.geometry)]);
}

describe("district map bounds", () => {
  it("encloses every Dhubri flood and parcel coordinate", () => {
    expect(getFixtureBounds("dhubri")).toEqual([[26.0153, 89.9578], [26.01825, 89.9748]]);
  });

  it("uses a separate enclosing extent for Darbhanga", () => {
    expect(getFixtureBounds("darbhanga")).toEqual([[26.1472, 85.8868], [26.1489, 85.8961]]);
  });
});
