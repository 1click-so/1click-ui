"use client"

import type { HttpTypes } from "@medusajs/types"
import { useState } from "react"

import { cn } from "../lib/utils"
import { convertToLocale } from "../lib/money"
import { useCheckoutLabels } from "./context"
import { MobileOrderSummaryBody } from "./mobile-order-summary-body"

/**
 * MobileCheckoutBottomBar — collapsed product-card summary that sits
 * directly above the "Place order" button on mobile. Visual language:
 * white card with first-item thumbnail + badge, "Обща сума / 2 артикула"
 * stack, price + chevron.
 *
 * Expanded state reveals the same line items + totals as the top bar
 * (shared via MobileOrderSummaryBody).
 *
 * Not rendered on desktop.
 */

type MobileCheckoutBottomBarProps = {
  cart: HttpTypes.StoreCart & {
    promotions?: HttpTypes.StorePromotion[]
  }
  optimisticShippingCost: number | null
}

export function MobileCheckoutBottomBar({
  cart,
  optimisticShippingCost,
}: MobileCheckoutBottomBarProps) {
  const labels = useCheckoutLabels()
  const [open, setOpen] = useState(false)

  const items = cart.items ?? []
  const itemCount = items.reduce((s, i) => s + i.quantity, 0)
  const firstItem = items[0]

  const shippingCost =
    optimisticShippingCost !== null
      ? optimisticShippingCost
      : cart.shipping_total
  const displayTotal =
    optimisticShippingCost !== null
      ? (cart.total ?? 0) -
        (cart.shipping_total ?? 0) +
        optimisticShippingCost
      : (cart.total ?? 0)

  if (!firstItem) return null

  return (
    <div className="sm:hidden rounded-[2px] border border-border bg-card overflow-hidden">
      {open && (
        <div className="px-5 pt-5 pb-2">
          <MobileOrderSummaryBody
            cart={cart}
            shippingCost={shippingCost}
            displayTotal={displayTotal}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left",
          open && "border-t border-border"
        )}
        aria-expanded={open}
      >
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border border-border">
            {firstItem.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={firstItem.thumbnail}
                alt={firstItem.product_title ?? ""}
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
          {itemCount > 1 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 text-[10px] font-bold rounded-full bg-foreground text-card flex items-center justify-center shadow-sm ring-2 ring-card">
              {itemCount}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-foreground leading-tight">
            {labels.total}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {itemCount} {labels.items}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-base font-bold text-foreground tracking-tight">
            {convertToLocale({
              amount: displayTotal,
              currency_code: cart.currency_code,
            })}
          </span>
          <svg
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-200",
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
        </div>
      </button>
    </div>
  )
}
