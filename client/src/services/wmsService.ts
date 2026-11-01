import area from "@turf/area";
import { feature, featureCollection } from "@turf/helpers";
import intersect from "@turf/intersect";

export type ActiveFloodGeoJson = GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, GeoJSON.GeoJsonProperties>;

export type WmsLayerConfig = {
  url: string;
  label: string;
  isFallback: boolean;
  layer?: "NDVI" | "SAR_FLOOD_MASK";
  time?: string;
  attribution: string;
};

export type TurfFloodAssessment = {
  parcelTotalHa: number;
  intersectedAreaHa: number;
  trueInundatedHa: number;
  lossPercentage: number;
  thresholdExceeded: boolean;
};

const ESRI_WORLD_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION = "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";
const CDSE_PROXY_URL = import.meta.env.VITE_WMS_PROXY_URL || "/api/wms-proxy";

/**
 * A non-secret build-time flag controls authenticated rendering. It remains
 * disabled until CDSE credentials and a permitted instance are configured on
 * the server, so demos never emit failing WMS tile requests.
 */
export function getWmsLayerMode() {
  const configured = import.meta.env.VITE_CDSE_WMS_ENABLED === "true";
  return {
    mode: configured ? "authenticated-cdse" as const : "demo-fallback" as const,
    configured,
    proxyUrl: CDSE_PROXY_URL,
  };
}

/** Compatibility name retained from the supplied service module. */
export const getLayerMode = getWmsLayerMode;

function getFallbackLayer(label: string): WmsLayerConfig {
  return { url: ESRI_WORLD_IMAGERY, label: `${label} · Esri World Imagery fallback`, isFallback: true, attribution: ESRI_ATTRIBUTION };
}

export function getSentinel2PreFloodLayer(dateFrom: string, dateTo: string): WmsLayerConfig {
  if (!getWmsLayerMode().configured) return getFallbackLayer("Pre-flood terrain");
  return {
    url: CDSE_PROXY_URL,
    label: "Sentinel-2 Pre-Flood NDVI",
    isFallback: false,
    layer: "NDVI",
    time: `${dateFrom}/${dateTo}`,
    attribution: "© Copernicus/ESA, Sentinel-2 via KISAN KAVACH proxy",
  };
}

export function getSentinel1PostFloodLayer(dateFrom: string, dateTo: string): WmsLayerConfig {
  if (!getWmsLayerMode().configured) return getFallbackLayer("Post-flood terrain");
  return {
    url: CDSE_PROXY_URL,
    label: "Sentinel-1 Post-Flood SAR",
    isFallback: false,
    layer: "SAR_FLOOD_MASK",
    time: `${dateFrom}/${dateTo}`,
    attribution: "© Copernicus/ESA, Sentinel-1 via KISAN KAVACH proxy",
  };
}

function toRenderedFloodFootprint(floodGeoJson: ActiveFloodGeoJson) {
  const coordinates = floodGeoJson.features.flatMap((flood) => flood.geometry.coordinates);
  return coordinates.length ? feature<GeoJSON.MultiPolygon>({ type: "MultiPolygon", coordinates }) : null;
}

/**
 * Performs the capped Turf intersection against the active geometry rendered by
 * Leaflet. This is used in demo mode as well as when an authenticated raster is
 * available, so a WMS layer cannot alter the cadastral claim calculation.
 */
export function calculateTurfFloodAssessment(
  parcelGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  floodGeoJson: ActiveFloodGeoJson | null,
): TurfFloodAssessment | null {
  if (!floodGeoJson) return null;
  const parcel = feature(parcelGeometry);
  const floodFootprint = toRenderedFloodFootprint(floodGeoJson);
  const parcelTotalHa = Number((area(parcel) / 10_000).toFixed(3));
  const intersection = floodFootprint
    ? intersect(featureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>([parcel, floodFootprint]))
    : null;
  const intersectedAreaHa = Number(((intersection ? area(intersection) : 0) / 10_000).toFixed(3));
  const trueInundatedHa = Math.min(intersectedAreaHa, parcelTotalHa);
  const lossPercentage = parcelTotalHa > 0 ? Number(((trueInundatedHa / parcelTotalHa) * 100).toFixed(1)) : 0;
  return { parcelTotalHa, intersectedAreaHa, trueInundatedHa, lossPercentage, thresholdExceeded: lossPercentage >= 20 };
}
