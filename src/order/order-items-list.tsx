import type { HttpTypes } from "@medusajs/types"
import { OrderItem } from "./order-item"
import { defaultOrderLabels, type OrderLabels } from "./labels"

type OrderItemsListProps = {
  order: HttpTypes.StoreOrder
  labels?: Pick<OrderLabels, "summary" | "qty">
}

export function OrderItemsList({ order, labels }: OrderItemsListProps) {
  const l = { ...defaultOrderLabels, ...labels }
  const items = order.items || []

  return (
    <div>
      <h2 className="text-sm font-semibold text-text-base mb-1">
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
