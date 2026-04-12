"use client"

import { convertToLocale } from "../lib/money"
import { useCartDrawer } from "./context"

/**
 * CartSummaryBreakdown — simple subtotal + "shipping calculated at
 * checkout" block. Not used by the default mindpages layout (which has a
 * sticky footer instead) but available as an alternative.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-summary-breakdown.tsx.
 */

export function CartSummaryBreakdown() {
  const { cart, labels } = useCartDrawer()
  if (!cart) return null

  const currencyCode = cart.currency_code
  const subtotal = cart.subtotal ?? 0
  const discount = cart.discount_total ?? 0
  const hasDiscount = discount > 0

  return (
    <div className="px-6 py-5">
      <div className="flex justify-between items-center">
        <span className="text-[15px] font-bold text-foreground">
          {labels.subtotal}
        </span>
        <div className="flex items-center gap-2">
          {hasDiscount && (
            <span className="text-[13px] text-muted-foreground line-through">
              {convertToLocale({
                amount: subtotal + discount,
                currency_code: currencyCode,
              })}
            </span>
          )}
          <span className="text-[17px] font-bold text-foreground tracking-tight">
            {convertToLocale({ amount: subtotal, currency_code: currencyCode })}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5">
        {labels.shippingAndTaxCalculatedAtCheckout}
      </p>
    </div>
  )
}
