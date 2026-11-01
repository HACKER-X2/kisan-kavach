import { describe, expect, it } from "vitest";
import { calculateIndicativePayout, getScaleOfFinance } from "./pmfbyPayout";

describe("PMFBY indicative Scale-of-Finance model", () => {
  it("uses the approved demonstrator rate and rounds capped-area payouts to rupees", () => {
    const scale = getScaleOfFinance("Assam", "Jute");
    expect(scale.amountPerHa).toBe(58_000);
    expect(scale.sourceStatus).toBe("user_configured_pending_state_notification");
    expect(calculateIndicativePayout(0.368, scale)).toBe(21_344);
  });

  it("returns zero for a crop without an approved demonstrator mapping", () => {
    expect(getScaleOfFinance("Bihar", "Pulses").amountPerHa).toBe(0);
  });
});
