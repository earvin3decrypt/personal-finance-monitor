/** Known tickers with display names and Yahoo Finance quote symbols. */
export const POPULAR_CRYPTO = [
  { symbol: "BTC", name: "Bitcoin", priceSymbol: "BTC-USD" },
  { symbol: "ETH", name: "Ethereum", priceSymbol: "ETH-USD" },
  { symbol: "SOL", name: "Solana", priceSymbol: "SOL-USD" },
  { symbol: "USDT", name: "Tether", priceSymbol: "USDT-USD" },
  { symbol: "USDC", name: "USD Coin", priceSymbol: "USDC-USD" },
] as const;

export function lookupCrypto(symbol: string) {
  const upper = symbol.trim().toUpperCase();
  return POPULAR_CRYPTO.find((c) => c.symbol === upper) ?? null;
}

export function toCryptoPriceSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  const known = lookupCrypto(upper);
  if (known) return known.priceSymbol;
  if (upper.includes("-")) return upper;
  return `${upper}-USD`;
}

export function cryptoDisplayName(symbol: string): string {
  return lookupCrypto(symbol)?.name ?? symbol.trim().toUpperCase();
}

const LOCAL_CRYPTO_LOGOS = new Set([
  "btc",
  "eth",
  "usdc",
  "link",
  "sol",
  "dot",
  "xmr",
]);

export function getCryptoLogoSrc(
  symbol: string,
): { src: string; local: boolean } | null {
  const upper = symbol.trim().toUpperCase();
  if (!upper) return null;

  const lower = upper.toLowerCase();

  if (lower === "nexo") {
    return { src: "/logos/nexo.png", local: true };
  }

  if (LOCAL_CRYPTO_LOGOS.has(lower)) {
    return { src: `/logos/crypto/${lower}.svg`, local: true };
  }

  return {
    src: `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${lower}.png`,
    local: false,
  };
}
