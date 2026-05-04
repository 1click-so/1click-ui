"use client"

import type { HttpTypes } from "@medusajs/types"
import { useMemo } from "react"

import { CheckoutLineItem } from "./checkout-line-item"
import { DualPrice } from "../lib/dual-price"
import { findFeeLine, isProductLine } from "../lib/cart-helpers"
import { useCheckoutLabels } from "./context"
import { DiscountSection } from "./discount-section"

/**
 * MobileOrderSummaryBody — the expanded content shared by the two mobile
 * order-summary collapsibles (top bar + bottom bar). Kept as a separate
 * primitive so both bars render the exact same line items + discount +
 * totals structure without duplication.
 *
 * Intentionally lacks a wrapper card / background — the parent bar
 * decides its own container styling (gray utility bar vs. white product
 * card).
 */

type MobileOrderSummaryBodyProps = {
  cart: HttpTypes.StoreCart & {
    promotions?: HttpTypes.StorePromotion[]
  }
  shippingCost: number | null | undefined
  /** Kept for parity with prior API; the final total is rendered by the
   * parent bar's collapsed header (no need to duplicate inside the body). */
  displayTotal?: number
  /** Admin-editable label for the COD fee row. Falls back to the line
   * item's title, then to `labels.codFee`. */
  codFeeLabel?: string
}

export function MobileOrderSummaryBody({
  cart,
  shippingCost,
  codFeeLabel,
}: MobileOrderSummaryBodyProps) {
  const labels = useCheckoutLabels()
  const allItems = cart.items ?? []
  // Same product/fee split as the desktop summary — products render as
  // line item rows, fee renders as a totals row between Shipping and
  // any discount.
  const productItems = useMemo(
    () => allItems.filter(isProductLine),
    [allItems]
  )
  const codFeeItem = useMemo(() => findFeeLine(allItems), [allItems])
  const shippingKnown = shippingCost !== null && shippingCost !== undefined

  const productSubtotal = useMemo(() => {
    if (!codFeeItem) return cart.item_total ?? 0
    const feeNet = codFeeItem.subtotal ?? codFeeItem.total ?? 0
    return Math.max(0, (cart.item_total ?? 0) - feeNet)
  }, [cart.item_total, codFeeItem])

  const codFeeAmount = codFeeItem?.total ?? 0
  const productItemCount = productItems.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="space-y-4 pt-4">
      <div className="divide-y divide-border">
        {productItems
          .slice()
          .sort((a, b) =>
            (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
          )
          .map((item) => (
            <div key={item.id} className="py-5 first:pt-0">
              <CheckoutLineItem
                item={item}
                currencyCode={cart.currency_code}
              />
            </div>
          ))}
      </div>

      <DiscountSection cart={cart} />

      <div className="space-y-2 pt-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {labels.subtotal} • {productItemCount} {labels.items}
          </span>
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
      </div>
    </div>
  )
}
