import { describe, expect, it } from "vitest";
import { CADASTRAL_STYLE, DEFAULT_DHUBRI_VIEW, DEFAULT_MAP_ZOOM, OPEN_STREET_MAP_TILES, SAR_FLOOD_STYLE, SELECTED_CADASTRAL_STYLE } from "../client/src/components/floodMapConfig";

describe("Flood map configuration", () => {
  it("uses the requested Dhubri default view and standard OSM tiles", () => {
    expect(DEFAULT_DHUBRI_VIEW).toEqual([26.028, 89.975]);
    expect(DEFAULT_MAP_ZOOM).toBe(13);
    expect(OPEN_STREET_MAP_TILES).toBe("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
  });

  it("uses the required SAR, cadastral, and selected-plot visual styles", () => {
    expect(SAR_FLOOD_STYLE).toMatchObject({ color: "#2563EB", fillColor: "#2563EB", fillOpacity: 0.4, weight: 1.5 });
    expect(CADASTRAL_STYLE).toMatchObject({ color: "#DC2626", fillColor: "#DC2626", fillOpacity: 0.1, weight: 2 });
    expect(SELECTED_CADASTRAL_STYLE).toMatchObject({ color: "#F59E0B", fillColor: "#F59E0B", weight: 3 });
  });
});
