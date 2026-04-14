"use client"

import type { HttpTypes } from "@medusajs/types"

import { DualPrice } from "../lib/dual-price"
import { convertToLocale } from "../lib/money"
import { useCheckoutLabels } from "./context"
import { DiscountSection } from "./discount-section"
import { LineItemCard } from "./line-item-card"

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
  displayTotal: number
}

export function MobileOrderSummaryBody({
  cart,
  shippingCost,
  displayTotal,
}: MobileOrderSummaryBodyProps) {
  const labels = useCheckoutLabels()
  const items = cart.items ?? []
  const shippingKnown = shippingCost !== null && shippingCost !== undefined

  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-3">
        {items
          .slice()
          .sort((a, b) =>
            (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
          )
          .map((item) => (
            <LineItemCard
              key={item.id}
              item={item}
              currencyCode={cart.currency_code}
            />
          ))}
      </div>

      <DiscountSection cart={cart} />

      <div className="space-y-2 pt-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {labels.subtotal} • {items.reduce((s, i) => s + i.quantity, 0)}{" "}
            {labels.items}
          </span>
          <DualPrice
            amount={cart.item_total ?? 0}
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

      <div className="flex items-baseline justify-between pt-3 border-t border-border">
        <span className="text-base font-bold text-foreground">
          {labels.total}
        </span>
        <span className="text-xl font-bold text-foreground tracking-tight">
          {convertToLocale({
            amount: displayTotal,
            currency_code: cart.currency_code,
          })}
        </span>
      </div>
    </div>
  )
}
