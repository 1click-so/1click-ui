"use client"

import type { HttpTypes } from "@medusajs/types"
import { useEffect, useMemo } from "react"

import { DualPrice } from "../lib/dual-price"
import { findFeeLine, isProductLine } from "../lib/cart-helpers"
import { CheckoutLineItem } from "./checkout-line-item"
import { useCheckoutLabels } from "./context"
import { DiscountSection } from "./discount-section"

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
  /**
   * Optimistic COD-fee prediction. Three values:
   *   - null         → no prediction; render whatever the cart says.
   *   - 0            → predict no fee (toggling away from COD).
   *   - positive     → predict the fee at this amount.
   * Pass `useCheckoutOrchestration`'s `optimisticCodFee`. Same pattern
   * as `optimisticShippingCost` — needed because the deferred-checkout
   * architecture (v1.21.0) defers fee writes until Buy click.
   */
  optimisticCodFee?: number | null
  onOptimisticCodFeeClear?: () => void
  /**
   * Admin-editable label for the cash-on-delivery fee row, sourced from
   * the cash_on_delivery integration_setting on the backend. Optional —
   * falls back to the fee line item's title, then to `labels.codFee`.
   */
  codFeeLabel?: string
}

export function OrderSummary({
  cart,
  optimisticShippingCost,
  onOptimisticShippingClear,
  optimisticCodFee,
  onOptimisticCodFeeClear,
  codFeeLabel,
}: OrderSummaryProps) {
  const labels = useCheckoutLabels()

  // Split products from any backend-injected fee line item. Fee renders
  // as a dedicated totals row between Shipping and Tax — never as a
  // product line with an empty thumbnail.
  const allItems = cart.items ?? []
  const productItems = useMemo(
    () => allItems.filter(isProductLine),
    [allItems]
  )
  const codFeeItem = useMemo(() => findFeeLine(allItems), [allItems])
  const itemCount = productItems.reduce((s, i) => s + i.quantity, 0)

  const shippingCost =
    optimisticShippingCost !== null ? optimisticShippingCost : cart.shipping_total
  const shippingKnown = shippingCost !== null && shippingCost !== undefined

  // Effective COD fee: optimistic prediction wins until the cart catches
  // up. Three states (null / 0 / positive) per AlenikaOrderSummary.
  const realCodFeeAmount = codFeeItem?.total ?? 0
  const effectiveCodFee =
    optimisticCodFee !== null && optimisticCodFee !== undefined
      ? optimisticCodFee
      : realCodFeeAmount

  const displayTotal = useMemo(() => {
    let total = cart.total ?? 0
    if (optimisticShippingCost !== null) {
      total = total - (cart.shipping_total ?? 0) + optimisticShippingCost
    }
    if (optimisticCodFee !== null && optimisticCodFee !== undefined) {
      total = total - realCodFeeAmount + effectiveCodFee
    }
    return total
  }, [
    cart.total,
    cart.shipping_total,
    optimisticShippingCost,
    optimisticCodFee,
    effectiveCodFee,
    realCodFeeAmount,
  ])

  // Subtotal excludes the fee line. Medusa's `cart.item_total` sums all
  // items including the fee — for the visible breakdown we want only
  // products. Subtract the fee's net (subtotal) so the visible Subtotal
  // line stays product-only while the Tax row continues to reflect the
  // full cart.tax_total (which includes the fee's tax portion).
  const productSubtotal = useMemo(() => {
    if (!codFeeItem) return cart.item_total ?? 0
    const feeNet = codFeeItem.subtotal ?? codFeeItem.total ?? 0
    return Math.max(0, (cart.item_total ?? 0) - feeNet)
  }, [cart.item_total, codFeeItem])

  const codFeeAmount = effectiveCodFee

  // Clear optimistic override once server cart reflects the new shipping cost
  useEffect(() => {
    if (
      optimisticShippingCost !== null &&
      cart.shipping_total === optimisticShippingCost
    ) {
      onOptimisticShippingClear?.()
    }
  }, [cart.shipping_total, optimisticShippingCost, onOptimisticShippingClear])

  // Clear optimistic COD fee once the cart's actual line item state
  // matches the prediction. Mirrors AlenikaOrderSummary.
  useEffect(() => {
    if (optimisticCodFee === null || optimisticCodFee === undefined) return
    const synced =
      (optimisticCodFee === 0 && !codFeeItem) ||
      (optimisticCodFee > 0 &&
        !!codFeeItem &&
        codFeeItem.total === optimisticCodFee)
    if (synced) onOptimisticCodFeeClear?.()
  }, [optimisticCodFee, codFeeItem, onOptimisticCodFeeClear])

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          {labels.orderSummary}
        </h2>
        <span className="text-sm text-muted-foreground">
          {itemCount} {labels.items}
        </span>
      </div>

      <div className="bg-card border border-border rounded-[2px] overflow-hidden shadow-sm">
        {/* Items section — bg-muted accent matches the mobile top-bar
            background so the items zone reads as a distinct surface from
            the totals section below. */}
        <div className="bg-muted px-5 sm:px-6 py-2 divide-y divide-border border-b border-border">
          {productItems
            .slice()
            .sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1))
            .map((item) => (
              <div key={item.id} className="py-5 first:pt-3 last:pb-3">
                <CheckoutLineItem
                  item={item}
                  currencyCode={cart.currency_code}
                />
              </div>
            ))}
        </div>

        <div className="px-5 sm:px-6 mt-4">
          <DiscountSection cart={cart} />
        </div>

        <div className="mx-5 sm:mx-6 my-5 h-px bg-border" />

        <div className="px-5 sm:px-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{labels.subtotal}</span>
            <DualPrice
              amount={productSubtotal}
              currencyCode={cart.currency_code}
              className="font-medium text-foreground"
            />
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{labels.shipping}</span>
            {shippingKnown ? (
              shippingCost === 0 ? (
                <span className="font-medium text-success">
                  {labels.shippingFree}
                </span>
              ) : (
                <DualPrice
                  amount={shippingCost ?? 0}
                  currencyCode={cart.currency_code}
                  className="font-medium text-foreground"
                />
              )
            ) : (
              <span className="font-medium text-foreground">
                {labels.shippingCalc}
              </span>
            )}
          </div>

          {codFeeAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {codFeeLabel ?? codFeeItem?.title ?? labels.codFee}
              </span>
              <DualPrice
                amount={codFeeAmount}
                currencyCode={cart.currency_code}
                className="font-medium text-foreground"
              />
            </div>
          )}

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
            <span className="text-muted-foreground flex items-center gap-1 relative group">
              {labels.tax}
              <svg
                className="w-3.5 h-3.5 text-muted-foreground cursor-help"
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
              <span className="absolute left-0 bottom-full mb-1.5 px-2.5 py-1.5 text-xs text-card bg-foreground rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                {labels.taxTooltip}
              </span>
            </span>
            <DualPrice
              amount={cart.tax_total ?? 0}
              currencyCode={cart.currency_code}
              className="font-medium text-foreground"
            />
          </div>
        </div>

        <div className="mx-5 sm:mx-6 mt-4 pt-4 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-foreground">
              {labels.total}
            </span>
            <div className="text-right">
              <DualPrice
                amount={displayTotal ?? 0}
                currencyCode={cart.currency_code}
                className="text-2xl font-bold text-foreground tracking-tight"
                bgnClassName="ml-2 text-sm text-muted-foreground/70 font-normal"
              />
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-6 pb-5 pt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
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
