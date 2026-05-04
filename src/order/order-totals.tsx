import type { HttpTypes } from "@medusajs/types"
import { DualPrice } from "../lib/dual-price"
import { findFeeLine } from "../lib/cart-helpers"
import { defaultOrderLabels, type OrderLabels } from "./labels"

type OrderTotalsProps = {
  order: HttpTypes.StoreOrder
  labels?: Pick<
    OrderLabels,
    "subtotal" | "shipping" | "discount" | "tax" | "total" | "free" | "codFee"
  >
  /**
   * Admin-editable label for the cash-on-delivery fee row, sourced
   * from the cash_on_delivery integration_setting on the backend (the
   * same value the storefront's checkout summary uses). Optional —
   * falls back to the fee line item's own title, then to the
   * translated `labels.codFee` default.
   */
  codFeeLabel?: string
}

export function OrderTotals({ order, labels, codFeeLabel }: OrderTotalsProps) {
  const l = { ...defaultOrderLabels, ...labels }
  const currencyCode = order.currency_code
  const hasDiscount = (order.discount_total ?? 0) > 0

  // Cash-on-delivery fee line (if any). The middleware adds it as a
  // tax-inclusive line item with `metadata.is_cod_fee=true`; the order
  // page hides that line in the items list and renders it here as a
  // dedicated totals row between Shipping and Tax.
  const codFeeItem = findFeeLine(order.items || [])
  const codFeeAmount = codFeeItem?.total ?? 0

  // Subtotal excludes the fee line. order.item_subtotal sums every
  // line item including the fee — for the visible breakdown we want
  // only the products. Subtract the fee's net (subtotal) so the
  // visible Subtotal stays product-only while the Tax row continues
  // to reflect order.tax_total (which includes the fee's tax portion).
  const productSubtotal = (() => {
    if (!codFeeItem) return order.item_subtotal ?? 0
    const feeNet = codFeeItem.subtotal ?? codFeeItem.total ?? 0
    return Math.max(0, (order.item_subtotal ?? 0) - feeNet)
  })()

  return (
    <div className="pt-4 border-t border-border">
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{l.subtotal}</span>
          <DualPrice
            amount={productSubtotal}
            currencyCode={currencyCode}
            className="text-sm text-foreground"
          />
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">{l.shipping}</span>
          {(order.shipping_subtotal ?? 0) === 0 ? (
            <span className="text-sm font-medium text-success">{l.free}</span>
          ) : (
            <DualPrice
              amount={order.shipping_subtotal ?? 0}
              currencyCode={currencyCode}
              className="text-sm text-foreground"
            />
          )}
        </div>

        {codFeeAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {codFeeLabel ?? codFeeItem?.title ?? l.codFee}
            </span>
            <DualPrice
              amount={codFeeAmount}
              currencyCode={currencyCode}
              className="text-sm text-foreground"
            />
          </div>
        )}

        {hasDiscount && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{l.discount}</span>
            <span className="text-sm text-success">
              -{" "}
              <DualPrice
                amount={order.discount_total ?? 0}
                currencyCode={currencyCode}
                className="text-sm text-success"
              />
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">{l.tax}</span>
          <DualPrice
            amount={order.tax_total ?? 0}
            currencyCode={currencyCode}
            className="text-sm text-foreground"
          />
        </div>
      </div>

      <div className="h-px bg-border my-3" />
      <div className="flex justify-between items-baseline">
        <span className="text-[15px] font-bold text-foreground">{l.total}</span>
        <DualPrice
          amount={order.total ?? 0}
          currencyCode={currencyCode}
          className="text-xl font-bold text-foreground tracking-tight"
        />
      </div>
    </div>
  )
}

export { type OrderTotalsProps }
