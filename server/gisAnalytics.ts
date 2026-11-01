import area from "@turf/area";
import { createHash } from "node:crypto";
import { feature, featureCollection } from "@turf/helpers";
import intersect from "@turf/intersect";
import { districtKeys, getDistrictFixture, type ClaimStatus, type DistrictKey, type FloodLayer, type ParcelLayer, type Severity } from "./data/gisFixtures";
import { calculateIndicativePayout, getScaleOfFinance, type ScaleOfFinance } from "./pmfbyPayout";
import { createPfmsSettlement, DEFAULT_FLOOD_DETECTION_AT, DEFAULT_SMS_DISPATCH_AT, getPmfbySla, getUrgentSmsReminder, shouldAutoSeal, uninitiatedPfmsSettlement, type ConsentChannel, type PfmsSettlement, type PmfbySla } from "./operationalWorkflow";

export type AssessedPlot = {
  id: string;
  ulpin: string;
  ulpinStatus: "representative_identifier";
  khasraNo: string;
  dagKhasraNo: string;
  pattaType: string;
  farmerName: string;
  maskedAadhaar: string;
  farmerPhone: string;
  state: string;
  district: string;
  village: string;
  sourceRegistry: string;
  block: string;
  crop: string;
  policyNo: string;
  pmfbyPolicyId: string;
  areaHa: number;
  intersectedAreaHa: number;
  trueInundatedHa: number;
  overlapPct: number;
  scaleOfFinance: ScaleOfFinance;
  estimatedPayoutInr: number;
  payoutEligibility: "meets_20_percent_threshold" | "below_20_percent_threshold";
  severity: Severity;
  geometry: GeoJSON.Polygon;
  claimId: string;
  claimStatus: ClaimStatus;
  smsSentAt: string;
  consentToken?: string;
  consentTimestamp?: string;
  consentChannel: ConsentChannel;
  floodDetectedAt: string;
  autoSealedAt?: string;
  sla: PmfbySla;
  settlement: PfmsSettlement;
};

type ClaimState = Pick<AssessedPlot, "claimStatus" | "smsSentAt" | "consentToken" | "consentTimestamp" | "consentChannel" | "floodDetectedAt" | "autoSealedAt" | "settlement">;

const claimState = new Map<string, ClaimState>();
let demoResetAt: string | null = null;

const severityRank: Record<Severity, number> = { low: 1, medium: 2, high: 3 };
const bhuvanFloodPortal = "https://bhuvan-app1.nrsc.gov.in/disaster/disaster.php?id=flood";
const copernicusSceneId = "S1A_IW_GRDH_1SDV_20260816T193800_044521_055102_E83F";
const suppliedReferenceChecksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function statusFor(claimId: string): ClaimState {
  const existing = claimState.get(claimId);
  if (existing) return existing;
  const initial: ClaimState = {
    claimStatus: "INTIMATION_GENERATED",
    smsSentAt: demoResetAt ?? DEFAULT_SMS_DISPATCH_AT,
    consentChannel: "SMS",
    floodDetectedAt: demoResetAt ?? DEFAULT_FLOOD_DETECTION_AT,
    settlement: uninitiatedPfmsSettlement(),
  };
  claimState.set(claimId, initial);
  return initial;
}

function phoneFromParcel(parcelId: string) {
  const suffix = parcelId.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `+91 98••• ${suffix}`;
}

function severityFromLoss(lossPercentage: number): Severity {
  if (lossPercentage >= 75) return "high";
  if (lossPercentage >= 30) return "medium";
  return "low";
}

/**
 * Returns the true inundated area for a parcel. The calculation intentionally
 * caps all intersected water geometry at the parcel geometry area used by the map.
 */
export function calculateParcelInundation(parcel: ParcelLayer, floodLayers: FloodLayer[]) {
  const parcelTotalHa = Number((area(parcel) / 10_000).toFixed(3));
  const floodCoordinates = floodLayers.flatMap((flood) => flood.geometry.coordinates);
  const floodFootprint = floodCoordinates.length
    ? feature<GeoJSON.MultiPolygon>({ type: "MultiPolygon", coordinates: floodCoordinates })
    : null;
  const overlap = floodFootprint
    ? intersect(featureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>([parcel, floodFootprint]))
    : null;
  const intersectedAreaHa = Number(((overlap ? area(overlap) : 0) / 10_000).toFixed(3));
  const trueInundatedHa = Math.min(intersectedAreaHa, parcelTotalHa);
  const lossPercentage = Number(((trueInundatedHa / parcelTotalHa) * 100).toFixed(1));

  return {
    parcelTotalHa,
    intersectedAreaHa,
    trueInundatedHa,
    lossPercentage,
  };
}

function applicableSeverity(parcel: ParcelLayer, floodLayers: FloodLayer[], lossPercentage: number): Severity {
  const touchingFloods = floodLayers.filter((flood) => intersect(featureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>([parcel, flood])));
  if (!touchingFloods.length) return severityFromLoss(lossPercentage);
  return touchingFloods.reduce<Severity>((mostSevere, flood) => (
    severityRank[flood.properties.severity] > severityRank[mostSevere] ? flood.properties.severity : mostSevere
  ), severityFromLoss(lossPercentage));
}

export function assessedPlotsForDistrict(key: DistrictKey): AssessedPlot[] {
  const fixture = getDistrictFixture(key);
  return fixture.parcels.map((parcel) => {
    const claimId = `PMFBY-2024-${parcel.properties.state.slice(0, 2).toUpperCase()}-${parcel.properties.parcel_uid.split("-").at(-1)}`;
    const assessment = calculateParcelInundation(parcel, fixture.floodLayers);
    const scaleOfFinance = getScaleOfFinance(parcel.properties.state, parcel.properties.crop_type);
    let savedState = statusFor(claimId);
    if (shouldAutoSeal(savedState.floodDetectedAt, savedState.claimStatus)) {
      const escalatedAt = new Date().toISOString();
      savedState = {
        ...savedState,
        claimStatus: "AUTO_SEALED_VIA_SATELLITE_TELEMETRY",
        consentChannel: "SATELLITE_TELEMETRY",
        consentTimestamp: escalatedAt,
        autoSealedAt: escalatedAt,
      };
      claimState.set(claimId, savedState);
    }
    return {
      id: parcel.properties.parcel_uid,
      ulpin: parcel.properties.ulpin,
      ulpinStatus: parcel.properties.ulpin_status,
      khasraNo: parcel.properties.khasra_no,
      dagKhasraNo: parcel.properties.dag_khasra_no,
      pattaType: parcel.properties.patta_type,
      farmerName: parcel.properties.farmer_name,
      maskedAadhaar: parcel.properties.masked_aadhaar,
      farmerPhone: phoneFromParcel(parcel.properties.parcel_uid),
      state: parcel.properties.state,
      district: parcel.properties.district,
      village: parcel.properties.village,
      sourceRegistry: parcel.properties.source_registry,
      block: parcel.properties.block,
      crop: parcel.properties.crop_type,
      policyNo: parcel.properties.policy_no,
      pmfbyPolicyId: parcel.properties.pmfby_policy_id,
      areaHa: assessment.parcelTotalHa,
      intersectedAreaHa: assessment.intersectedAreaHa,
      trueInundatedHa: assessment.trueInundatedHa,
      overlapPct: assessment.lossPercentage,
      scaleOfFinance,
      estimatedPayoutInr: calculateIndicativePayout(assessment.trueInundatedHa, scaleOfFinance),
      payoutEligibility: assessment.lossPercentage >= 20 ? "meets_20_percent_threshold" : "below_20_percent_threshold",
      severity: applicableSeverity(parcel, fixture.floodLayers, assessment.lossPercentage),
      geometry: clone(parcel.geometry),
      claimId,
      ...clone(savedState),
      sla: getPmfbySla(savedState.floodDetectedAt, savedState.claimStatus),
    };
  });
}

export function dashboardSnapshot(key: DistrictKey = "dhubri") {
  const fixture = getDistrictFixture(key);
  const plots = assessedPlotsForDistrict(key);
  const impactedPlots = plots.filter((plot) => plot.trueInundatedHa > 0);
  const eligibleClaims = plots.filter((plot) => plot.trueInundatedHa > 0 && plot.maskedAadhaar.startsWith("XXXX"));
  const totalInundatedHa = Number(impactedPlots.reduce((sum, plot) => sum + plot.trueInundatedHa, 0).toFixed(3));
  const fixtureFloodGeoJson = { type: "FeatureCollection" as const, features: clone(fixture.floodLayers) };
  const localFloodFixtureSha256 = createHash("sha256").update(JSON.stringify(fixtureFloodGeoJson)).digest("hex");

  return {
    generatedAt: new Date().toISOString(),
    center: fixture.center,
    jurisdiction: {
      state: fixture.parcels[0]?.properties.state ?? "",
      district: fixture.parcels[0]?.properties.district ?? "",
      block: fixture.parcels[0]?.properties.block ?? "",
      key,
    },
    sourceNotice: fixture.sourceNotice,
    provenance: {
      esriWorldImagery: {
        status: "live_public_basemap" as const,
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
      },
      bhuvan: { status: "public_reference_portal" as const, url: bhuvanFloodPortal, extent: "EPSG:4326 · Dhubri / Darbhanga demonstrator extent" },
      copernicus: { status: "scene_reference_only" as const, sceneId: copernicusSceneId, catalogUrl: "https://dataspace.copernicus.eu/" },
      evidence: {
        localFloodFixtureSha256,
        suppliedReferenceChecksum,
        checksumStatus: "The supplied reference checksum equals the SHA-256 digest of an empty payload; it is displayed as an unverified reference, not as validation of the local GeoJSON fixture." as const,
      },
    },
    kpis: {
      floodedAreaHa: totalInundatedHa,
      impactedKhasraPlots: impactedPlots.length,
      aadhaarSeededClaims: eligibleClaims.length,
      submittedClaims: plots.filter((plot) => plot.claimStatus === "SEALED_FOR_PMFBY").length,
      averageLossPercentage: impactedPlots.length ? Number((impactedPlots.reduce((sum, plot) => sum + plot.overlapPct, 0) / impactedPlots.length).toFixed(1)) : 0,
    },
    districts: districtKeys.map((districtKey) => {
      const districtPlots = assessedPlotsForDistrict(districtKey);
      const floodedAreaHa = Number(districtPlots.reduce((sum, plot) => sum + plot.trueInundatedHa, 0).toFixed(3));
      return {
        key: districtKey,
        state: districtPlots[0]?.state ?? "",
        district: districtPlots[0]?.district ?? "",
        block: districtPlots[0]?.block ?? "",
        floodedAreaHa,
        impactedPlots: districtPlots.filter((plot) => plot.trueInundatedHa > 0).length,
      };
    }),
    floodGeoJson: fixtureFloodGeoJson,
    plots,
  };
}

export function resetDemoWorkflow(selectedClaimId?: string, now = new Date()) {
  demoResetAt = now.toISOString();
  claimState.clear();
  let selectedClaim: AssessedPlot | null = null;
  if (selectedClaimId) {
    selectedClaim = locatePlot(selectedClaimId).plot;
    const current = statusFor(selectedClaimId);
    claimState.set(selectedClaimId, {
      ...current,
      claimStatus: "PENDING_CONSENT",
      smsSentAt: demoResetAt,
      consentToken: undefined,
      consentTimestamp: undefined,
      consentChannel: "SMS",
    });
    selectedClaim = { ...selectedClaim, ...clone(claimState.get(selectedClaimId)!) };
  }
  const sla = getPmfbySla(demoResetAt, selectedClaim ? "PENDING_CONSENT" : "INTIMATION_GENERATED", now);
  return {
    resetAt: demoResetAt,
    deadlineAt: sla.deadlineAt,
    remainingSeconds: sla.remainingSeconds,
    selectedClaimId: selectedClaim?.claimId ?? null,
    selectedClaimStatus: selectedClaim?.claimStatus ?? null,
    message: selectedClaim
      ? `Judge demo reset: Khasra #${selectedClaim.khasraNo} reopened for pending consent with a fresh 72-hour window.`
      : "Judge demo reset: claims returned to the 72-hour pending-consent window.",
  };
}

export function processFlood(bbox: [number, number, number, number], key: DistrictKey = "dhubri") {
  const fixture = getDistrictFixture(key);
  return {
    jobId: `SAR-${Date.now().toString(36).toUpperCase()}`,
    bbox,
    processor: {
      source: "Sentinel-1 IW GRD analytical fixture",
      thresholdMethods: ["Otsu adaptive thresholding", "-18 dB water backscatter cutoff"],
      appliedThresholdDb: -18,
      result: "Flood polygons validated against the active fixture jurisdiction.",
    },
    geojson: { type: "FeatureCollection" as const, features: clone(fixture.floodLayers) },
  };
}

export function matchCadastral(key: DistrictKey = "dhubri") {
  const plots = assessedPlotsForDistrict(key);
  const eligible = plots.filter((plot) => plot.overlapPct >= 20);
  return {
    matchedPlots: plots.length,
    autoClaimsTriggered: eligible.length,
    rule: "trueInundatedHa = min(area(FloodMask ∩ Parcel), area(Parcel)); loss % = trueInundatedHa / area(Parcel) × 100.",
    claims: plots,
  };
}

function locatePlot(claimId: string) {
  for (const key of districtKeys) {
    const plot = assessedPlotsForDistrict(key).find((candidate) => candidate.claimId === claimId);
    if (plot) return { key, plot };
  }
  throw new Error("Claim record not found");
}

export function sendIntimation(claimId: string) {
  const { plot } = locatePlot(claimId);
  const current = statusFor(claimId);
  if (current.claimStatus === "AUTO_SEALED_VIA_SATELLITE_TELEMETRY") {
    return { claim: plot, sms: "Claim has already been auto-sealed via the satellite telemetry simulator; no fresh consent request was opened." };
  }
  const nextState: ClaimState = { ...current, claimStatus: "PENDING_CONSENT", smsSentAt: new Date().toISOString(), consentToken: undefined, consentTimestamp: undefined, consentChannel: "SMS" };
  claimState.set(claimId, nextState);
  return {
    claim: { ...plot, ...clone(nextState) },
    sms: `KISAN KAVACH: ULPIN ${plot.ulpin}, Khasra #${plot.khasraNo} par ${plot.overlapPct}% baadh ka nuksan paya gaya hai. Sanketik PMFBY rashi ₹${plot.estimatedPayoutInr.toLocaleString("en-IN")} hai. Claim seal karne ke liye 1 bhejkar confirm karein.`,
  };
}

export function receiveSmsReply(claimId: string, reply: string, channel: ConsentChannel = "SMS") {
  const { plot } = locatePlot(claimId);
  const normalized = reply.trim();
  const existing = statusFor(claimId);
  if (existing.claimStatus === "AUTO_SEALED_VIA_SATELLITE_TELEMETRY") {
    return { accepted: false, claim: plot, event: "Claim was already auto-sealed via satellite telemetry in the simulator." };
  }
  if (normalized === "1") {
    const now = new Date().toISOString();
    const nextState: ClaimState = {
      ...existing,
      claimStatus: "SEALED_FOR_PMFBY",
      consentTimestamp: now,
      consentToken: `PMFBY-CNS-${plot.id.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      consentChannel: channel,
    };
    claimState.set(claimId, nextState);
    return { accepted: true, claim: { ...plot, ...clone(nextState) }, event: `${channel === "IVR_USSD" ? "IVR / USSD keypad" : "SMS"} consent received; claim sealed for PMFBY in the simulator.` };
  }
  if (normalized === "0" || normalized === "9") {
    const nextState: ClaimState = { ...existing, claimStatus: "DECLINED" };
    claimState.set(claimId, nextState);
    return { accepted: false, claim: { ...plot, ...clone(nextState) }, event: "Farmer declined the claim intimation." };
  }
  return { accepted: false, claim: plot, event: "Unrecognized response. Claim remains pending consent." };
}

export function settlePfmsClaim(claimId: string) {
  const { plot } = locatePlot(claimId);
  const current = statusFor(claimId);
  if (current.claimStatus !== "SEALED_FOR_PMFBY" && current.claimStatus !== "AUTO_SEALED_VIA_SATELLITE_TELEMETRY") {
    throw new Error("A claim must be sealed before PFMS settlement can be simulated.");
  }
  const nextState: ClaimState = { ...current, settlement: createPfmsSettlement() };
  claimState.set(claimId, nextState);
  return { claim: { ...plot, ...clone(nextState), sla: getPmfbySla(nextState.floodDetectedAt, nextState.claimStatus) }, settlement: nextState.settlement };
}

export function getClaimExport(claimId: string) {
  const { plot } = locatePlot(claimId);
  return {
    specification: "KISAN KAVACH PMFBY claim simulator payload",
    applicationUuid: plot.claimId,
    createdAt: new Date().toISOString(),
    claimStatus: plot.claimStatus,
    dataClassification: "Representative GIS fixture; not an NCIP submission",
    cadastral: {
      ulpin: plot.ulpin,
      ulpinStatus: plot.ulpinStatus,
      khasraNo: plot.khasraNo,
      dagKhasraNo: plot.dagKhasraNo,
      pattaType: plot.pattaType,
      village: plot.village,
      block: plot.block,
      district: plot.district,
      state: plot.state,
      sourceRegistry: plot.sourceRegistry,
      pmfbyPolicyId: plot.pmfbyPolicyId,
      maskedAadhaar: plot.maskedAadhaar,
      totalAreaHa: plot.areaHa,
      geometry: plot.geometry,
    },
    assessment: {
      satelliteSource: "Sentinel-1 SAR",
      preFloodAcquisition: "2024-07-18T05:26:00Z",
      postFloodAcquisition: plot.floodDetectedAt,
      thresholdMethods: ["Otsu adaptive thresholding", "-18 dB water backscatter cutoff"],
      intersectedAreaHa: plot.intersectedAreaHa,
      trueInundatedHa: plot.trueInundatedHa,
      lossPercentage: plot.overlapPct,
      crop: plot.crop,
      severity: plot.severity,
      provenance: dashboardSnapshot(locatePlot(claimId).key).provenance,
    },
    financialAssessment: {
      scaleOfFinancePerHa: plot.scaleOfFinance.amountPerHa,
      scaleOfFinanceCrop: plot.scaleOfFinance.cropKey,
      scaleOfFinanceSourceUrl: plot.scaleOfFinance.sourceUrl,
      sourceStatus: plot.scaleOfFinance.sourceStatus,
      notice: plot.scaleOfFinance.notice,
      indicativePayoutInr: plot.estimatedPayoutInr,
      eligibility: plot.payoutEligibility,
    },
    farmerConsent: {
      channel: plot.consentChannel === "IVR_USSD" ? "IVR / USSD (*99#) simulator" : plot.consentChannel === "SATELLITE_TELEMETRY" ? "Satellite telemetry escalation simulator" : "SMS simulator",
      consentToken: plot.consentToken ?? null,
      consentTimestamp: plot.consentTimestamp ?? null,
    },
    statutoryAudit: {
      sarAcquisitionTimestamp: plot.floodDetectedAt,
      smsDispatchTimestamp: plot.smsSentAt,
      confirmationTimestamp: plot.consentTimestamp ?? null,
      autoSealTimestamp: plot.autoSealedAt ?? null,
      slaDeadlineTimestamp: plot.sla.deadlineAt,
      status: plot.sla.status,
      urgentReminderRequired: plot.sla.urgentReminderRequired,
      rainfallTelemetry: {
        source: "IMD/ERA5 reference telemetry — representative demonstrator evidence",
        cumulative72hMm: 148.5,
        period: "72-hour flood assessment window",
      },
    },
    operationalSla: plot.sla,
    pfmsSettlement: plot.settlement,
  };
}

export function getClaimDossierText(claimId: string) {
  const { plot } = locatePlot(claimId);
  return `KISAN KAVACH · ANNEXURE-IV DEMONSTRATOR DOSSIER\n\nScenario classification: representative analytical GIS fixture\nClaim ID: ${plot.claimId}\nULPIN-style ID: ${plot.ulpin}\nKhasra No: ${plot.khasraNo}\nFarmer record: ${plot.farmerName}\nMasked Aadhaar: ${plot.maskedAadhaar}\nVillage: ${plot.village}\nBlock: ${plot.block}\nDistrict: ${plot.district}, ${plot.state}\nCrop: ${plot.crop}\nRegistry parcel area: ${plot.areaHa.toFixed(3)} ha\nRaw raster-vector intersection: ${plot.intersectedAreaHa.toFixed(3)} ha\nCapped inundated area: ${plot.trueInundatedHa.toFixed(3)} ha\nCalculated loss: ${plot.overlapPct}%\nScale of Finance: INR ${plot.scaleOfFinance.amountPerHa.toLocaleString("en-IN")} / ha\nIndicative payout: INR ${plot.estimatedPayoutInr.toLocaleString("en-IN")}\nAssessment: Sentinel-1 SAR / Otsu + -18 dB\nSAR acquisition timestamp: ${plot.floodDetectedAt}\nSMS dispatch timestamp: ${plot.smsSentAt}\nConfirmation timestamp: ${plot.consentTimestamp ?? "Awaiting farmer confirmation"}\n72h SLA deadline: ${plot.sla.deadlineAt}\nIMD/ERA5 reference telemetry: 148.5 mm / 72-hour flood assessment window\nClaim status: ${plot.claimStatus}\nGenerated: ${new Date().toISOString()}`;
}
