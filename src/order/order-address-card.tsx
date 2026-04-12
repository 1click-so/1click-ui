import type { HttpTypes } from "@medusajs/types"
import { defaultOrderLabels, type OrderLabels } from "./labels"

type OrderAddressCardProps = {
  order: HttpTypes.StoreOrder
  labels?: Pick<OrderLabels, "contactInfo">
}

export function OrderAddressCard({ order, labels }: OrderAddressCardProps) {
  const l = { ...defaultOrderLabels, ...labels }
  const addr = order.shipping_address

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        {l.contactInfo}
      </h3>
      <div className="space-y-1 text-sm text-muted-foreground">
        {addr && (
          <p className="font-medium text-foreground">
            {addr.first_name} {addr.last_name}
          </p>
        )}
        {addr?.phone && <p>{addr.phone}</p>}
        <p>{order.email}</p>
      </div>
    </div>
  )
}

export { type OrderAddressCardProps }
