import type { HttpTypes } from "@medusajs/types"
import { OrderItem } from "./order-item"
import { isProductLine } from "../lib/cart-helpers"
import { defaultOrderLabels, type OrderLabels } from "./labels"

type OrderItemsListProps = {
  order: HttpTypes.StoreOrder
  labels?: Pick<OrderLabels, "summary" | "qty">
}

export function OrderItemsList({ order, labels }: OrderItemsListProps) {
  const l = { ...defaultOrderLabels, ...labels }
  // Render product lines only — backend-injected fee lines (e.g. COD
  // fee, see medusa-mindpages/src/api/store/payment-collections/[id]/
  // payment-sessions/middleware.ts) are hidden here and surfaced as a
  // dedicated row in OrderTotals instead.
  const items = (order.items || []).filter(isProductLine)

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-1">
        {l.summary}
      </h2>
      <div className="divide-y divide-border">
        {items
          .sort((a, b) =>
            (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
          )
          .map((item) => (
            <OrderItem
              key={item.id}
              item={item}
              currencyCode={order.currency_code}
              labels={labels}
            />
          ))}
      </div>
    </div>
  )
}

export { type OrderItemsListProps }
