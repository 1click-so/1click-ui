"use client"

import type { HttpTypes } from "@medusajs/types"
import { useState } from "react"

import { cn } from "../lib/utils"
import { DualPrice } from "../lib/dual-price"
import { findFeeLine } from "../lib/cart-helpers"
import { useCheckoutLabels } from "./context"
import { MobileOrderSummaryBody } from "./mobile-order-summary-body"

/**
 * MobileCheckoutTopBar — the collapsed utility row that sits near the top
 * of the mobile checkout (below the store wordmark, above the contact
 * form). Mirrors the Shopify mobile pattern: text-forward gray bar with
 * a chevron + total; expands to reveal line items + totals.
 *
 * Defaults collapsed — Shopify's research shows users scan the total
 * first, open the summary only if they want to verify items.
 *
 * Not rendered on desktop (the right-column OrderSummary is always
 * visible there).
 */

type MobileCheckoutTopBarProps = {
  cart: HttpTypes.StoreCart & {
    promotions?: HttpTypes.StorePromotion[]
  }
  optimisticShippingCost: number | null
  /** Optimistic COD-fee prediction. See MobileCheckoutBottomBar. */
  optimisticCodFee?: number | null
  /** Admin-editable label for the COD fee row in the expanded body. */
  codFeeLabel?: string
}

export function MobileCheckoutTopBar({
  cart,
  optimisticShippingCost,
  optimisticCodFee,
  codFeeLabel,
}: MobileCheckoutTopBarProps) {
  const labels = useCheckoutLabels()
  const [open, setOpen] = useState(false)

  const shippingCost =
    optimisticShippingCost !== null
      ? optimisticShippingCost
      : cart.shipping_total
  // See MobileCheckoutBottomBar — same formula kept in lockstep.
  const realCodFeeAmount = findFeeLine(cart.items ?? null)?.total ?? 0
  let displayTotal = cart.total ?? 0
  if (optimisticShippingCost !== null) {
    displayTotal =
      displayTotal - (cart.shipping_total ?? 0) + optimisticShippingCost
  }
  if (optimisticCodFee !== null && optimisticCodFee !== undefined) {
    displayTotal = displayTotal - realCodFeeAmount + optimisticCodFee
  }

  return (
    <div className="sm:hidden bg-muted border-y border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          {labels.orderSummary}
          <svg
            className={cn(
              "w-4 h-4 transition-transform duration-200",
              open && "rotate-180"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.25}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </span>
        <DualPrice
          amount={displayTotal}
          currencyCode={cart.currency_code}
          className="text-base font-bold text-foreground tracking-tight"
          bgnClassName="ml-1.5 text-xs text-muted-foreground/70 font-normal"
        />
      </button>

      {open && (
        <div className="px-5 pb-5">
          <MobileOrderSummaryBody
            cart={cart}
            shippingCost={shippingCost}
            displayTotal={displayTotal}
            optimisticCodFee={optimisticCodFee}
            codFeeLabel={codFeeLabel}
          />
        </div>
      )}
    </div>
  )
}
