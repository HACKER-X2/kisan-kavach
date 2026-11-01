import { describe, expect, it } from "vitest";
import { createPfmsSettlement, getPmfbySla, getUrgentSmsReminder, PFMS_DEMO_UTR, PMFBY_SLA_HOURS, SAR_ACQUISITION_AT, shouldAutoSeal } from "./operationalWorkflow";

describe("PMFBY operational workflow simulator", () => {
  const detectedAt = SAR_ACQUISITION_AT;

  it("derives the statutory deadline exactly 72 hours after flood detection", () => {
    const withinWindow = getPmfbySla(detectedAt, "PENDING_CONSENT", new Date("2026-08-17T19:38:00.000Z"));
    expect(PMFBY_SLA_HOURS).toBe(72);
    expect(withinWindow.deadlineAt).toBe("2026-08-19T19:38:00.000Z");
    expect(withinWindow.remainingSeconds).toBe(48 * 60 * 60);
    expect(withinWindow.status).toBe("WITHIN_72H_WINDOW");
    expect(withinWindow.displayLabel).toBe("SLA Active: 48 hours remaining");
  });

  it("raises the urgent SMS reminder only below 24 hours and carries the payout amount", () => {
    const urgent = getPmfbySla(detectedAt, "PENDING_CONSENT", new Date("2026-08-19T02:00:00.000Z"));
    expect(urgent.urgentReminderRequired).toBe(true);
    expect(getUrgentSmsReminder(urgent, 24176)).toContain("expires in 18h");
    expect(getUrgentSmsReminder(urgent, 24176)).toContain("₹24,176");
    const notUrgent = getPmfbySla(detectedAt, "PENDING_CONSENT", new Date("2026-08-18T00:00:00.000Z"));
    expect(getUrgentSmsReminder(notUrgent, 24176)).toBeNull();
  });

  it("only flags unresolved consent for automatic telemetry escalation after the deadline", () => {
    expect(shouldAutoSeal(detectedAt, "PENDING_CONSENT", new Date("2026-08-19T19:38:00.000Z"))).toBe(true);
    expect(shouldAutoSeal(detectedAt, "SEALED_FOR_PMFBY", new Date("2026-08-20T19:38:00.000Z"))).toBe(false);
    expect(getPmfbySla(detectedAt, "AUTO_SEALED_VIA_SATELLITE_TELEMETRY", new Date("2026-08-20T19:38:00.000Z")).displayLabel).toContain("Auto-Sealed via Satellite Telemetry");
  });

  it("returns a transparent non-production PFMS/NPCI APB settlement record", () => {
    const settlement = createPfmsSettlement(new Date("2026-08-18T05:30:00.000Z"));
    expect(settlement.utr).toBe(PFMS_DEMO_UTR);
    expect(settlement.status).toBe("DIRECT_BENEFIT_TRANSFER_SUCCESSFUL");
    expect(settlement.targetAccount).toContain("XXXX XXXX 4621");
    expect(settlement.notice).toContain("Simulated payment only");
  });
});
