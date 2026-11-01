import { describe, expect, it } from "vitest";
import metadata from "../shared/spectral_audit_metadata.json";

describe("spectral audit metadata", () => {
  it("uses Esri World Imagery as a live basemap with the required attribution", () => {
    expect(metadata.basemap.renderingStatus).toBe("live_public_basemap");
    expect(metadata.basemap.tileUrlTemplate).toBe("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
    expect(metadata.basemap.attribution).toContain("Tiles © Esri");
  });

  it("records Bhuvan and CDSE as references instead of asserting live WMS rendering", () => {
    expect(metadata.wmsReferences.bhuvanDisaster.renderingStatus).toBe("reference_only");
    expect(metadata.wmsReferences.copernicusCdse.suppliedEndpointStatus).toBe("invalid_dns_host");
    expect(metadata.wmsReferences.copernicusCdse.documentedEndpointPattern).toContain("<INSTANCE_ID>");
    expect(metadata.displayDisclaimer).toContain("no authorized live WMS layer is rendered");
  });
});
