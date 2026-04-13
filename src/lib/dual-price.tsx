"use client"

import * as React from "react"

import { cn } from "./utils"
import { convertToLocale } from "./money"

/**
 * DualPrice — render a EUR price with BGN next to it.
 *
 * Bulgarian law (Дв, effective through 2026-08) requires showing both EUR
 * and BGN on every price displayed to consumers. Fixed statutory rate:
 *   1 EUR = 1.95583 BGN
 *
 * For non-EUR currencies the BGN leg is skipped and only the primary locale
 * currency is shown. The component is stateless and side-effect-free — safe
 * to render in server components and client components alike.
 *
 * The EUR-to-BGN rate and the law's expiry date are baked in for now. When
 * the law expires (or when a store outside Bulgaria consumes this library),
 * we'll move both to a BrandingContext value so each store can override.
 *
 * @example
 *   <DualPrice amount={19.99} currencyCode="eur" />
 *   // → "€19.99  39,10 лв."
 */

const EUR_TO_BGN = 1.95583

function toBGN(eurAmount: number): string {
  const bgn = eurAmount * EUR_TO_BGN
  return bgn.toFixed(2).replace(".", ",") + " лв."
}

export type DualPriceProps = {
  /** Amount in major units of the primary currency (e.g. 19.99 for €19.99) */
  amount: number
  /** ISO currency code (case-insensitive). Only "eur" triggers the BGN leg. */
  currencyCode: string
  /** Optional class for the outer span */
  className?: string
  /** Optional class for the BGN leg (defaults to small muted) */
  bgnClassName?: string
}

export function DualPrice({
  amount,
  currencyCode,
  className,
  bgnClassName,
}: DualPriceProps): React.ReactElement {
  const isEur = currencyCode?.toLowerCase() === "eur"

  if (!isEur) {
    return (
      <span className={className}>
        {convertToLocale({ amount, currency_code: currencyCode })}
      </span>
    )
  }

  return (
    <span className={className}>
      {convertToLocale({ amount, currency_code: currencyCode })}
      <span className={cn("ml-1.5 text-muted-foreground/70 font-normal", bgnClassName)}>
        {toBGN(amount)}
      </span>
    </span>
  )
}

/** Exposed for advanced callers that need the rate directly. */
export const EUR_TO_BGN_RATE = EUR_TO_BGN
