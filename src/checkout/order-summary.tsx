"use client"

import type { HttpTypes } from "@medusajs/types"
import { useEffect } from "react"

import { convertToLocale } from "../lib/money"
import { DualPrice } from "../lib/dual-price"
import { useCheckoutLabels } from "./context"
import { DiscountSection } from "./discount-section"
import { LineItemCard } from "./line-item-card"

/**
 * OrderSummary — the right column of the checkout: scrollable list of
 * line items, discount code, subtotal / shipping / tax / total, optional
 * optimistic shipping override used during method selection.
 *
 * Extracted from mindpages-storefront checkout-client/index.tsx lines
 * 1187-1386.
 */

type OrderSummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions?: HttpTypes.StorePromotion[]
  }
  /**
   * Optimistic shipping total during method selection. Pass `null` when
   * there is no optimistic override so the server value is used.
   */
  optimisticShippingCost: number | null
  onOptimisticShippingClear?: () => void
}

export function OrderSummary({
  cart,
  optimisticShippingCost,
  onOptimisticShippingClear,
}: OrderSummaryProps) {
  const labels = useCheckoutLabels()

  const items = cart.items ?? []
  const itemCount = items.reduce((s, i) => s + i.quantity, 0)

  const shippingCost =
    optimisticShippingCost !== null ? optimisticShippingCost : cart.shipping_total
  const shippingKnown = shippingCost !== null && shippingCost !== undefined

  const displayTotal =
    optimisticShippingCost !== null
      ? (cart.total ?? 0) -
        (cart.shipping_total ?? 0) +
        optimisticShippingCost
      : cart.total

  // Clear optimistic override once server cart reflects the new shipping cost
  useEffect(() => {
    if (
      optimisticShippingCost !== null &&
      cart.shipping_total === optimisticShippingCost
    ) {
      onOptimisticShippingClear?.()
    }
  }, [cart.shipping_total, optimisticShippingCost, onOptimisticShippingClear])

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-base tracking-tight">
          {labels.orderSummary}
        </h2>
        <span className="text-sm text-text-subtle">
          {itemCount} {labels.items}
        </span>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 pt-5 space-y-5">
          {items
            .slice()
            .sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1))
            .map((item) => (
              <LineItemCard
                key={item.id}
                item={item}
                currencyCode={cart.currency_code}
              />
            ))}
        </div>

        <div className="px-6 mt-6">
          <DiscountSection cart={cart} />
        </div>

        <div className="mx-6 my-5 h-px bg-border" />

        <div className="px-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">{labels.subtotal}</span>
            <DualPrice
              amount={cart.item_total ?? 0}
              currencyCode={cart.currency_code}
              className="font-medium text-text-base"
            />
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-text-muted">{labels.shipping}</span>
            {shippingKnown ? (
              shippingCost === 0 ? (
                <span className="font-medium text-success">
                  {labels.shippingFree}
                </span>
              ) : (
                <DualPrice
                  amount={shippingCost ?? 0}
                  currencyCode={cart.currency_code}
                  className="font-medium text-text-base"
                />
              )
            ) : (
              <span className="font-medium text-text-base">
                {labels.shippingCalc}
              </span>
            )}
          </div>

          {!!cart.discount_total && (
            <div className="flex justify-between text-sm text-success">
              <span>{labels.discount}</span>
              <span className="font-medium">
                -
                <DualPrice
                  amount={cart.discount_total}
                  currencyCode={cart.currency_code}
                />
              </span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-text-muted flex items-center gap-1 relative group">
              {labels.tax}
              <svg
                className="w-3.5 h-3.5 text-text-subtle cursor-help"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="absolute left-0 bottom-full mb-1.5 px-2.5 py-1.5 text-xs text-surface bg-text-base rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                {labels.taxTooltip}
              </span>
            </span>
            <DualPrice
              amount={cart.tax_total ?? 0}
              currencyCode={cart.currency_code}
              className="font-medium text-text-base"
            />
          </div>
        </div>

        <div className="mx-6 mt-4 pt-4 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-text-base">
              {labels.total}
            </span>
            <div className="text-right">
              <span className="text-2xl font-bold text-text-base tracking-tight">
                {convertToLocale({
                  amount: displayTotal ?? 0,
                  currency_code: cart.currency_code,
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 pt-4 flex items-center justify-center gap-2 text-xs text-text-subtle">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>{labels.secureCheckout}</span>
        </div>
      </div>
    </div>
  )
}
