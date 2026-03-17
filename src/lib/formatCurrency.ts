// ─── Supported currencies ───────────────────────────────────────────────────
export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "GBP", symbol: "£", label: "GBP (£)" },
  { code: "INR", symbol: "₹", label: "INR (₹)" },
  { code: "CNY", symbol: "¥", label: "CNY (¥)" },
  { code: "JPY", symbol: "¥", label: "JPY (¥)" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  CNY: "¥",
  JPY: "¥",
};

// localStorage persistence key
export const CURRENCY_STORAGE_KEY = "cleardebt_currency";

/** Full currency format: ₹1,234  /  $12,345  /  ¥1,234 */
export function formatCurrency(
  n: number,
  currency: CurrencyCode = "USD"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** 2-decimal variant used only in LoanFormModal's EMI preview */
export function formatCurrency2dp(
  n: number,
  currency: CurrencyCode = "USD"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Compact axis formatter for Recharts Y/X axes.
 * Produces: "$12k", "€12k", "₹12k" — always en-US comma style.
 */
export function formatAxisTick(
  val: number,
  currency: CurrencyCode = "USD"
): string {
  const sym = CURRENCY_SYMBOLS[currency];
  return `${sym}${(val / 1000).toFixed(0)}k`;
}
