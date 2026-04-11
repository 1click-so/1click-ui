/**
 * Money utilities — pure, side-effect-free currency formatting helpers.
 *
 * Extracted from mindpages-storefront src/lib/util/money.ts + isEmpty.ts.
 * Used by DualPrice and any other price rendering in the library.
 */

function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "object") return Object.keys(value as object).length === 0
  return false
}

export type ConvertToLocaleParams = {
  amount: number
  currency_code: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  locale?: string
}

/**
 * Format a numeric amount as a localized currency string.
 *
 * @example
 *   convertToLocale({ amount: 19.99, currency_code: "eur" })
 *   // → "€19.99"
 */
export function convertToLocale({
  amount,
  currency_code,
  minimumFractionDigits,
  maximumFractionDigits,
  locale = "en-US",
}: ConvertToLocaleParams): string {
  return currency_code && !isEmpty(currency_code)
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency_code,
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(amount)
    : amount.toString()
}

/**
 * Currencies that Medusa stores WITHOUT minor units (no cent division).
 * Used when converting between minor-unit (Medusa's internal representation)
 * and major-unit (display) amounts.
 */
export const noDivisionCurrencies = [
  "krw",
  "jpy",
  "vnd",
  "clp",
  "pyg",
  "xaf",
  "xof",
  "bif",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "rwf",
  "xpf",
  "htg",
  "vuv",
  "xag",
  "xdr",
  "xau",
] as const
