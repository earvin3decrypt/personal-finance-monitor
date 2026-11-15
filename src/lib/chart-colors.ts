/** Same soft mix as Spending by category radial fills. */
const PASTEL_WHITE_MIX = 0.28;

export function pastelHex(hex: string, whiteMix = PASTEL_WHITE_MIX): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * whiteMix);
  return `#${[mix(r), mix(g), mix(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Category palette hexes used by Spending by category (seed / BASE_PALETTE). */
export const BREAKDOWN_COLORS: Record<string, string> = {
  Cash: pastelHex("#22c55e"),
  Investments: pastelHex("#8b5cf6"),
  Crypto: pastelHex("#f97316"),
};

/** Net worth series / sparkline — blue from the same spending palette. */
export const NET_WORTH_COLOR = pastelHex("#3b82f6");
