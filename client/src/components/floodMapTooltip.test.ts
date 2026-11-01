import { describe, expect, it } from "vitest";
import { formatKhasraTooltip } from "./floodMapTooltip";

describe("formatKhasraTooltip", () => {
  it("includes the Khasra plot ID and calculated loss percentage", () => {
    expect(formatKhasraTooltip({ khasraNo: "413/1", overlapPct: 19.5 })).toBe("Khasra #413/1 · Loss 19.5%");
  });
});
