import type { AssessedPlot } from "../../../server/gisAnalytics";
import { calculateTurfFloodAssessment, type ActiveFloodGeoJson, type TurfFloodAssessment } from "@/services/wmsService";

export type { ActiveFloodGeoJson } from "@/services/wmsService";

export type LiveFloodAssessment = TurfFloodAssessment;

/**
 * Combines the exact MultiPolygon coordinates rendered by Leaflet into a single
 * Turf input. No projected or synthetic geometry is introduced here.
 */
/**
 * Computes the currently selected parcel's loss from the same active GeoJSON
 * passed to the Leaflet flood overlay. Deliberately ignores precomputed fixture
 * summary values so the inspector and spectral panel cannot become stale.
 */
export function calculateLiveFloodAssessment(plot: AssessedPlot | null, floodGeoJson: ActiveFloodGeoJson | null): LiveFloodAssessment | null {
  if (!plot || !floodGeoJson) return null;
  return calculateTurfFloodAssessment(plot.geometry, floodGeoJson);
}
