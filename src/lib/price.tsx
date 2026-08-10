"use client"

import * as React from "react"

import { convertToLocale } from "./money"

/**
 * Price — render a money amount in a single currency.
 *
 * Replaces `DualPrice`, which rendered every EUR amount a second time in
 * BGN at the statutory 1.95583 rate. Bulgaria's dual-display requirement
 * has ended and the country is on the euro outright, so the second leg is
 * not merely unnecessary — it is wrong to show.
 *
 * Deliberately not kept behind a flag. A flag would leave the conversion
 * code, the hard-coded rate and the second `<span>` alive in every price
 * on every store, waiting to be switched back on by accident.
 *
 * @example
 *   <Price amount={19.99} currencyCode="eur" />   // → "€19.99"
 */

export type PriceProps = {
  /** Amount in major units (e.g. 19.99 for €19.99). */
  amount: number
  /** ISO currency code, case-insensitive. */
  currencyCode: string
  className?: string
}

export function Price({
  amount,
  currencyCode,
  className,
}: PriceProps): React.ReactElement {
  return (
    <span className={className}>
      {convertToLocale({ amount, currency_code: currencyCode })}
    </span>
  )
}
