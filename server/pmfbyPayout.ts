export type ScaleOfFinance = {
  amountPerHa: number;
  cropKey: string;
  sourceUrl: string;
  sourceStatus: "user_configured_pending_state_notification";
  notice: string;
};

const DATA_GOV_PMF_BY_CATALOG = "https://www.data.gov.in/keywords/pmfby";

/**
 * These values were supplied in the approved demonstrator brief. The public
 * catalog page did not expose a directly usable state-and-crop resource ID,
 * therefore this mapping must be refreshed against a state notification before
 * it is used in a production claim decision.
 */
const scaleOfFinance: Record<string, ScaleOfFinance> = {
  "assam:paddy (kharif)": { amountPerHa: 64_500, cropKey: "Assam Kharif Sali Paddy", sourceUrl: DATA_GOV_PMF_BY_CATALOG, sourceStatus: "user_configured_pending_state_notification", notice: "Demonstrator configuration supplied for this build; refresh from the applicable state notification before production use." },
  "assam:jute": { amountPerHa: 58_000, cropKey: "Assam Jute", sourceUrl: DATA_GOV_PMF_BY_CATALOG, sourceStatus: "user_configured_pending_state_notification", notice: "Demonstrator configuration supplied for this build; refresh from the applicable state notification before production use." },
  "assam:maize": { amountPerHa: 52_000, cropKey: "Assam Maize (reference rate)", sourceUrl: DATA_GOV_PMF_BY_CATALOG, sourceStatus: "user_configured_pending_state_notification", notice: "Demonstrator configuration supplied for this build; refresh from the applicable state notification before production use." },
  "bihar:maize": { amountPerHa: 52_000, cropKey: "Bihar Kharif Maize", sourceUrl: DATA_GOV_PMF_BY_CATALOG, sourceStatus: "user_configured_pending_state_notification", notice: "Demonstrator configuration supplied for this build; refresh from the applicable state notification before production use." },
  "assam:ahu paddy": { amountPerHa: 61_200, cropKey: "Assam Ahu Paddy", sourceUrl: DATA_GOV_PMF_BY_CATALOG, sourceStatus: "user_configured_pending_state_notification", notice: "Demonstrator configuration supplied for this build; refresh from the applicable state notification before production use." },
};

function keyFor(state: string, crop: string) {
  return `${state.trim().toLowerCase()}:${crop.trim().toLowerCase()}`;
}

export function getScaleOfFinance(state: string, crop: string): ScaleOfFinance {
  const direct = scaleOfFinance[keyFor(state, crop)];
  if (direct) return direct;
  const normalizedCrop = crop.toLowerCase();
  if (normalizedCrop.includes("paddy")) return scaleOfFinance["assam:paddy (kharif)"];
  if (normalizedCrop.includes("maize")) return scaleOfFinance[state.toLowerCase() === "bihar" ? "bihar:maize" : "assam:maize"];
  if (normalizedCrop.includes("jute")) return scaleOfFinance["assam:jute"];
  return { amountPerHa: 0, cropKey: "No configured crop scale", sourceUrl: DATA_GOV_PMF_BY_CATALOG, sourceStatus: "user_configured_pending_state_notification", notice: "No demonstrator Scale-of-Finance mapping is configured for this state and crop." };
}

export function calculateIndicativePayout(trueInundatedHa: number, scale: ScaleOfFinance) {
  return Math.round(trueInundatedHa * scale.amountPerHa);
}
