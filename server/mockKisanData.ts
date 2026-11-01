import area from "@turf/area";
import { featureCollection, polygon } from "@turf/helpers";
import intersect from "@turf/intersect";

export type Severity = "high" | "medium" | "low";
export type ClaimStatus = "INTIMATION_GENERATED" | "PENDING_CONSENT" | "SUBMITTED_NCIP" | "DECLINED";

type Coordinates = GeoJSON.Position[][];

export type KhasraPlot = {
  id: string;
  khasraNo: string;
  farmerName: string;
  farmerPhone: string;
  state: "Assam";
  district: "Dhubri";
  village: string;
  block: "Golakganj";
  crop: string;
  policyNo: string;
  areaHa: number;
  overlapPct: number;
  severity: Severity;
  geometry: GeoJSON.Polygon;
  claimId: string;
  claimStatus: ClaimStatus;
  smsSentAt: string;
  consentToken?: string;
  consentTimestamp?: string;
};

export type FloodFeature = GeoJSON.Feature<GeoJSON.Polygon, {
  id: string;
  severity: Severity;
  state: "Assam";
  district: "Dhubri";
  block: "Golakganj";
  sarDb: number;
  areaHa: number;
  source: "Sentinel-1 IW GRD";
  acquisitionDate: string;
}>;

const center = { latitude: 26.02, longitude: 89.97 };
const isoNow = "2026-08-17T04:12:00.000Z";

function parcel(left: number, bottom: number, width: number, height: number): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [[
      [left, bottom], [left + width, bottom], [left + width, bottom + height],
      [left, bottom + height], [left, bottom],
    ]],
  };
}

const parcelSpecs = [
  ["402/1", "Rameshwar Kumar", "Paddy (Kharif)", 89.955, 26.012, 0.014, 0.010, 82, "high"],
  ["451/1", "Bhola Prasad", "Paddy (Kharif)", 89.973, 26.012, 0.014, 0.010, 86, "high"],
  ["317/3", "Savitri Devi", "Maize", 89.991, 26.012, 0.014, 0.010, 61, "medium"],
  ["503/4", "Urmila Singh", "Sugarcane", 89.955, 26.028, 0.014, 0.010, 77, "high"],
  ["198/1", "Raghunandan Yadav", "Paddy (Kharif)", 89.973, 26.028, 0.014, 0.010, 95, "high"],
  ["744/1", "Shyamal Paswan", "Paddy (Kharif)", 89.991, 26.028, 0.014, 0.010, 88, "high"],
] as const;

export const khasraPlots: KhasraPlot[] = parcelSpecs.map(([khasraNo, farmerName, crop, left, bottom, width, height]) => ({
  id: `dhubri-${khasraNo.replace("/", "-")}`,
  khasraNo,
  farmerName,
  farmerPhone: "+91 94XXX XXXXX",
  state: "Assam",
  district: "Dhubri",
  village: "Bahera",
  block: "Golakganj",
  crop,
  policyNo: `AS-PMFBY-2024-${khasraNo.replace("/", "")}`,
  areaHa: Number((width * height * 12321000).toFixed(2)),
  overlapPct: 0,
  severity: (parcelSpecs.find((item) => item[0] === khasraNo)?.[7] as unknown as Severity) ?? "medium",
  geometry: parcel(left, bottom, width, height),
  claimId: `PMFBY-2024-AS-${khasraNo.replace("/", "")}`,
  claimStatus: "PENDING_CONSENT",
  smsSentAt: isoNow,
}));

const floodDefinitions = [
  { plotIndex: 0, coveragePct: 82, severity: "high" as const, sarDb: -20.7 },
  { plotIndex: 1, coveragePct: 86, severity: "high" as const, sarDb: -20.2 },
  { plotIndex: 2, coveragePct: 61, severity: "medium" as const, sarDb: -18.9 },
  { plotIndex: 3, coveragePct: 77, severity: "high" as const, sarDb: -19.8 },
  { plotIndex: 4, coveragePct: 95, severity: "high" as const, sarDb: -21.1 },
  { plotIndex: 5, coveragePct: 88, severity: "high" as const, sarDb: -20.4 },
];

function coverageMask(plot: KhasraPlot, coveragePct: number): GeoJSON.Polygon {
  const [[left, bottom], [right], [, top]] = plot.geometry.coordinates[0] as GeoJSON.Position[];
  const maskRight = Number(left) + (Number(right) - Number(left)) * (coveragePct / 100);
  return parcel(Number(left), Number(bottom), maskRight - Number(left), Number(top) - Number(bottom));
}

export const floodFeatures: FloodFeature[] = floodDefinitions.map((definition) => {
  const plot = khasraPlots[definition.plotIndex];
  const geometry = coverageMask(plot, definition.coveragePct);
  return {
    type: "Feature",
    properties: {
      id: `S1A_IW_GRD_DHUBRI_${plot.khasraNo.replace("/", "")}`,
      severity: definition.severity,
      state: "Assam",
      district: "Dhubri",
      block: "Golakganj",
      sarDb: definition.sarDb,
      areaHa: Number((area(polygon(geometry.coordinates)) / 10000).toFixed(2)),
      source: "Sentinel-1 IW GRD",
      acquisitionDate: "2024-08-06T05:26:00Z",
    },
    geometry,
  };
});

function intersectionLossPct(plot: KhasraPlot) {
  const plotFeature = polygon(plot.geometry.coordinates);
  const intersectingMasks = floodFeatures
    .filter((flood) => flood.properties.district === plot.district)
    .map((flood) => intersect(featureCollection([plotFeature, polygon(flood.geometry.coordinates)])))
    .filter(Boolean);
  const floodedArea = intersectingMasks.reduce((total, result) => total + (result ? area(result) : 0), 0);
  return Math.min(100, Math.round((floodedArea / area(plotFeature)) * 100));
}

function refreshClaimMatches() {
  khasraPlots.forEach((plot) => {
    plot.overlapPct = intersectionLossPct(plot);
    if (plot.overlapPct >= 20 && plot.claimStatus === "INTIMATION_GENERATED") plot.claimStatus = "PENDING_CONSENT";
  });
  return khasraPlots;
}

const clone = <T>(value: T): T => structuredClone(value);

export function dashboardSnapshot() {
  refreshClaimMatches();
  return {
    generatedAt: new Date().toISOString(),
    center,
    jurisdiction: { state: "Assam", district: "Dhubri", block: "Golakganj" },
    kpis: { floodedAreaHa: 14250, impactedKhasraPlots: 3420, aadhaarSeededClaims: 3180, cropLossValueCr: 21.92, savedAreaHa: 6840 },
    districts: [{ state: "Assam", district: "Dhubri", floodedArea: 14250, claimsTriggered: 3180, lossValue: 21.92, successRate: 92.9, status: "Critical" }],
    floodGeoJson: { type: "FeatureCollection" as const, features: clone(floodFeatures) },
    plots: clone(khasraPlots),
  };
}

export function processFlood(bbox: [number, number, number, number]) {
  return {
    jobId: `SAR-${Date.now().toString(36).toUpperCase()}`,
    bbox,
    processor: {
      source: "Sentinel-1 IW GRD / Dhubri Assam 2024 flood archive",
      thresholdMethods: ["Otsu adaptive thresholding", "-18 dB water backscatter cutoff"],
      appliedThresholdDb: -18,
      result: "Flood mask vectorized into high, medium, and low inundation GeoJSON polygons",
    },
    geojson: { type: "FeatureCollection" as const, features: clone(floodFeatures) },
  };
}

export function matchCadastral() {
  const plots = refreshClaimMatches();
  const eligible = plots.filter((plot) => plot.overlapPct >= 20);
  return {
    matchedPlots: eligible.length,
    autoClaimsTriggered: eligible.length,
    rule: "Loss % = Area(Flood_Mask ∩ Khasra_Plot) / Area(Khasra_Plot) × 100; overlap ≥ 20% triggers PMFBY intimation.",
    claims: clone(plots),
  };
}

export function sendIntimation(claimId: string) {
  const plot = khasraPlots.find((item) => item.claimId === claimId);
  if (!plot) throw new Error("Claim record not found");
  refreshClaimMatches();
  plot.claimStatus = "PENDING_CONSENT";
  plot.smsSentAt = new Date().toISOString();
  return { claim: clone(plot), sms: `KISAN KAVACH: Khasra #${plot.khasraNo} par ${plot.overlapPct}% baadh ka nuksan paya gaya hai. PMFBY claim shuru karne ke liye '1' bhejkar confirm karein.` };
}

export function receiveSmsReply(claimId: string, reply: string) {
  const plot = khasraPlots.find((item) => item.claimId === claimId);
  if (!plot) throw new Error("Claim record not found");
  const normalized = reply.trim();
  if (normalized === "1") {
    const now = new Date().toISOString();
    plot.claimStatus = "SUBMITTED_NCIP";
    plot.consentTimestamp = now;
    plot.consentToken = `PMFBY-CNS-${plot.id.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    return { accepted: true, claim: clone(plot), event: "Valid farmer consent sealed and submitted to NCIP mock gateway." };
  }
  if (normalized === "9") {
    plot.claimStatus = "DECLINED";
    return { accepted: false, claim: clone(plot), event: "Farmer declined the claim intimation." };
  }
  return { accepted: false, claim: clone(plot), event: "Unrecognized response. Claim remains pending consent." };
}

export function getClaimExport(claimId: string) {
  const plot = khasraPlots.find((item) => item.claimId === claimId);
  if (!plot) throw new Error("Claim record not found");
  refreshClaimMatches();
  return {
    specification: "PMFBY DigiClaim-compliant structured JSON",
    applicationUuid: plot.claimId,
    createdAt: new Date().toISOString(),
    claimStatus: plot.claimStatus,
    cadastral: { khasraNo: plot.khasraNo, village: plot.village, block: plot.block, district: plot.district, state: plot.state, geometry: plot.geometry },
    assessment: { satelliteSource: "Sentinel-1 SAR", preFloodAcquisition: "2024-07-18T05:26:00Z", postFloodAcquisition: "2024-08-06T05:26:00Z", thresholdMethods: ["Otsu adaptive thresholding", "-18 dB water backscatter cutoff"], inundationPercentage: plot.overlapPct, crop: plot.crop, severity: plot.severity },
    farmerConsent: { channel: "SMS", consentToken: plot.consentToken ?? null, consentTimestamp: plot.consentTimestamp ?? null },
  };
}

export function getAnnexureIvText(claimId: string) {
  const plot = khasraPlots.find((item) => item.claimId === claimId);
  if (!plot) throw new Error("Claim record not found");
  refreshClaimMatches();
  return `PMFBY ANNEXURE-IV\n\nClaim ID: ${plot.claimId}\nKhasra No: ${plot.khasraNo}\nFarmer: ${plot.farmerName}\nVillage: ${plot.village}\nBlock: ${plot.block}\nDistrict: ${plot.district}, ${plot.state}\nCrop: ${plot.crop}\nFlood loss percentage: ${plot.overlapPct}%\nAssessment: Sentinel-1 SAR / Otsu + -18 dB\nClaim status: ${plot.claimStatus}\nGenerated: ${new Date().toISOString()}`;
}
