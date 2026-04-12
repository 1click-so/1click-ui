import type { HttpTypes } from "@medusajs/types"
import { DualPrice } from "../lib/dual-price"
import { defaultOrderLabels, type OrderLabels } from "./labels"

type OrderTotalsProps = {
  order: HttpTypes.StoreOrder
  labels?: Pick<OrderLabels, "subtotal" | "shipping" | "discount" | "tax" | "total" | "free">
}

export function OrderTotals({ order, labels }: OrderTotalsProps) {
  const l = { ...defaultOrderLabels, ...labels }
  const currencyCode = order.currency_code
  const hasDiscount = (order.discount_total ?? 0) > 0

  return (
    <div className="pt-4 border-t border-border">
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">{l.subtotal}</span>
          <DualPrice
            amount={order.item_subtotal ?? 0}
            currencyCode={currencyCode}
            className="text-sm text-text-base"
          />
        </div>

        <div className="flex justify-between">
          <span className="text-text-muted">{l.shipping}</span>
          {(order.shipping_subtotal ?? 0) === 0 ? (
            <span className="text-sm font-medium text-success">{l.free}</span>
          ) : (
            <DualPrice
              amount={order.shipping_subtotal ?? 0}
              currencyCode={currencyCode}
              className="text-sm text-text-base"
            />
          )}
        </div>

        {hasDiscount && (
          <div className="flex justify-between">
            <span className="text-text-muted">{l.discount}</span>
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
          <span className="text-text-muted">{l.tax}</span>
          <DualPrice
            amount={order.tax_total ?? 0}
            currencyCode={currencyCode}
            className="text-sm text-text-base"
          />
        </div>
      </div>

      <div className="h-px bg-border my-3" />
      <div className="flex justify-between items-baseline">
        <span className="text-[15px] font-bold text-text-base">{l.total}</span>
        <DualPrice
          amount={order.total ?? 0}
          currencyCode={currencyCode}
          className="text-xl font-bold text-text-base tracking-tight"
        />
      </div>
    </div>
  )
}

export { type OrderTotalsProps }
