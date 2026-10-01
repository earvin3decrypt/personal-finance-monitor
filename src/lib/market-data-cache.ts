/** How long DB-cached FX/prices count as live after a successful fetch. */
export const MARKET_DATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function isMarketDataCacheFresh(fetchedAt: string | null): boolean {
  if (!fetchedAt) return false;
  const age = Date.now() - new Date(fetchedAt).getTime();
  return age >= 0 && age < MARKET_DATA_CACHE_TTL_MS;
}
