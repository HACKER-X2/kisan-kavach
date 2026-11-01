import type { ClaimStatus } from "./data/gisFixtures";

export const PMFBY_SLA_HOURS = 72;
export const SAR_ACQUISITION_AT = "2026-08-16T19:38:00.000Z";
export const DEFAULT_FLOOD_DETECTION_AT = SAR_ACQUISITION_AT;
export const DEFAULT_SMS_DISPATCH_AT = "2026-08-16T20:00:00.000Z";
export const PMFBY_URGENT_WINDOW_HOURS = 24;
export const PFMS_DEMO_UTR = "PFMS2026INB88219401";

export type ConsentChannel = "SMS" | "IVR_USSD" | "SATELLITE_TELEMETRY";
export type SettlementStatus = "NOT_INITIATED" | "DIRECT_BENEFIT_TRANSFER_SUCCESSFUL";

export type PmfbySla = {
  floodDetectedAt: string;
  sarAcquisitionAt: string;
  deadlineAt: string;
  remainingSeconds: number;
  remainingHours: number;
  urgentReminderRequired: boolean;
  status: "WITHIN_72H_WINDOW" | "AUTO_SEALED_VIA_SATELLITE_TELEMETRY" | "SEALED_BY_FARMER";
  escalationRule: "Rule 14.2 escalation simulator";
  displayLabel: string;
};

export type PfmsSettlement = {
  status: SettlementStatus;
  utr: string | null;
  targetAccount: string;
  settledAt: string | null;
  rail: "NPCI APB simulator";
  notice: "Simulated payment only — no PFMS, NPCI, bank, or PM-KISAN account is contacted.";
};

export function getPmfbySla(floodDetectedAt: string, claimStatus: ClaimStatus, now = new Date()): PmfbySla {
  const detectedAt = new Date(floodDetectedAt);
  const deadline = new Date(detectedAt.getTime() + PMFBY_SLA_HOURS * 60 * 60 * 1000);
  const remainingSeconds = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000));
  const remainingHours = Math.ceil(remainingSeconds / (60 * 60));
  const farmerSealed = claimStatus === "SEALED_FOR_PMFBY";
  const autoSealed = claimStatus === "AUTO_SEALED_VIA_SATELLITE_TELEMETRY";
  const urgentReminderRequired = !farmerSealed && !autoSealed && remainingSeconds > 0 && remainingSeconds < PMFBY_URGENT_WINDOW_HOURS * 60 * 60;
  return {
    floodDetectedAt: detectedAt.toISOString(),
    sarAcquisitionAt: detectedAt.toISOString(),
    deadlineAt: deadline.toISOString(),
    remainingSeconds,
    remainingHours,
    urgentReminderRequired,
    status: autoSealed ? "AUTO_SEALED_VIA_SATELLITE_TELEMETRY" : farmerSealed ? "SEALED_BY_FARMER" : "WITHIN_72H_WINDOW",
    escalationRule: "Rule 14.2 escalation simulator",
    displayLabel: autoSealed
      ? "Auto-Sealed via Satellite Telemetry (Rule 14.2 Escalation)"
      : farmerSealed
        ? "Sealed by farmer confirmation within the statutory window"
        : `SLA Active: ${remainingHours} hours remaining`,
  };
}

/** Returns the simulated statutory reminder only while a pending claim has under 24 hours remaining. */
export function getUrgentSmsReminder(sla: PmfbySla, indicativePayoutInr: number) {
  if (!sla.urgentReminderRequired) return null;
  return `URGENT: PMFBY 72h intimation window expires in ${sla.remainingHours}h. Reply 1 to seal your ₹${indicativePayoutInr.toLocaleString("en-IN")} claim.`;
}

export function shouldAutoSeal(floodDetectedAt: string, claimStatus: ClaimStatus, now = new Date()) {
  const pending = claimStatus === "PENDING_CONSENT" || claimStatus === "INTIMATION_GENERATED";
  return pending && now.getTime() >= new Date(floodDetectedAt).getTime() + PMFBY_SLA_HOURS * 60 * 60 * 1000;
}

export function createPfmsSettlement(now = new Date()): PfmsSettlement {
  return {
    status: "DIRECT_BENEFIT_TRANSFER_SUCCESSFUL",
    utr: PFMS_DEMO_UTR,
    targetAccount: "Linked PM-KISAN Bank A/C · XXXX XXXX 4621",
    settledAt: now.toISOString(),
    rail: "NPCI APB simulator",
    notice: "Simulated payment only — no PFMS, NPCI, bank, or PM-KISAN account is contacted.",
  };
}

export function uninitiatedPfmsSettlement(): PfmsSettlement {
  return {
    status: "NOT_INITIATED",
    utr: null,
    targetAccount: "Linked PM-KISAN Bank A/C · XXXX XXXX 4621",
    settledAt: null,
    rail: "NPCI APB simulator",
    notice: "Simulated payment only — no PFMS, NPCI, bank, or PM-KISAN account is contacted.",
  };
}
