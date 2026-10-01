export const SUPPORTED_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "AUD",
  "JPY",
  "SEK",
  "NOK",
  "DKK",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: string): value is CurrencyCode {
  return SUPPORTED_CURRENCIES.includes(value as CurrencyCode);
}
