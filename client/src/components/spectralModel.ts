import type { AssessedPlot } from "../../../server/gisAnalytics";
import { deriveDistrictBounds } from "./floodMapBounds";
import spectralAuditMetadata from "@shared/spectral_audit_metadata.json";
import type { LiveFloodAssessment } from "./liveFloodAssessment";

export const PMFBY_INTIMATION_THRESHOLD = 20;
export const DEFAULT_SPECTRAL_KHASRA = "413/1";
export const DEFAULT_SPECTRAL_REVEAL_PERCENT = 52;
export const SPECTRAL_AUDIT_METADATA = spectralAuditMetadata;

export function selectInitialSpectralPlotId(plots: AssessedPlot[]) {
  return plots.find((plot) => plot.khasraNo === DEFAULT_SPECTRAL_KHASRA)?.id ?? plots[0]?.id ?? null;
}

export function normalizeRevealPercent(value: number) {
  return Math.min(92, Math.max(8, value));
}

export function getBeforeRevealWidth(value: number) {
  const revealPercent = normalizeRevealPercent(value);
  return {
    revealPercent,
    innerWidthPercent: 10000 / revealPercent,
  };
}

export function getParcelCentroid(plot: AssessedPlot | null) {
  if (!plot) return null;
  const bounds = deriveDistrictBounds([plot.geometry]);
  if (!bounds) return null;
  const [[south, west], [north, east]] = bounds;
  return { latitude: (south + north) / 2, longitude: (west + east) / 2 };
}

export function getSpectralSummary(assessment: LiveFloodAssessment | null) {
  if (!assessment) return null;
  return {
    submergedAreaHa: assessment.trueInundatedHa,
    cadastralAreaHa: assessment.parcelTotalHa,
    lossPercentage: assessment.lossPercentage,
    thresholdExceeded: assessment.thresholdExceeded,
  };
}

export function getSpectralMetadata(plot: AssessedPlot | null, assessment: LiveFloodAssessment | null) {
  const centroid = getParcelCentroid(plot);
  if (!plot || !centroid) return null;
  return {
    location: `Khasra #${plot.khasraNo} · ${plot.block} Block, ${plot.district} District, ${plot.state}${plot.district === "Dhubri" ? " (Brahmaputra Basin)" : ""}`,
    centroid,
    cadastralAreaHa: assessment?.parcelTotalHa ?? null,
  };
}
