export type KhasraTooltipData = {
  khasraNo: string;
  overlapPct: number;
};

export function formatKhasraTooltip({ khasraNo, overlapPct }: KhasraTooltipData) {
  return `Khasra #${khasraNo} · Loss ${overlapPct.toFixed(1)}%`;
}
