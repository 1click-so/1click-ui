import type { HttpTypes } from "@medusajs/types"
import { MapPin, Truck } from "lucide-react"
import { DualPrice } from "../lib/dual-price"
import { defaultOrderLabels, type OrderLabels } from "./labels"

type OrderDeliveryCardProps = {
  order: HttpTypes.StoreOrder
  labels?: Pick<OrderLabels, "delivery" | "free">
}

export function OrderDeliveryCard({ order, labels }: OrderDeliveryCardProps) {
  const l = { ...defaultOrderLabels, ...labels }
  const method = order.shipping_methods?.[0]
  const metadata = (order as any).metadata || {}
  const addr = order.shipping_address

  const hasEcontMetadata = !!metadata.econt_office_code
  const methodName = (method?.name || "").toLowerCase()
  const isPickupByName =
    methodName.includes("еконт") ||
    methodName.includes("econt") ||
    methodName.includes("офис")
  const isPickup = hasEcontMetadata || isPickupByName

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        {l.delivery}
      </h3>

      {isPickup ? (
        <div className="space-y-3">
          {hasEcontMetadata ? (
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-[18px] h-[18px] text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {metadata.econt_office_name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {metadata.econt_office_address}
                  {metadata.econt_office_city
                    ? `, ${metadata.econt_office_city}`
                    : ""}
                </p>
                {metadata.econt_office_phone && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {metadata.econt_office_phone}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-[18px] h-[18px] text-success" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {method?.name}
              </p>
            </div>
          )}

          {method && (
            <>
              <div className="h-px bg-border" />
              <ShippingMethodRow method={method} order={order} labels={l} />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {addr && (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                {addr.address_1}
                {addr.address_2 ? `, ${addr.address_2}` : ""}
              </p>
              <p>
                {addr.postal_code} {addr.city}
              </p>
              <p>{addr.country_code?.toUpperCase()}</p>
            </div>
          )}
          {method && (
            <>
              <div className="h-px bg-border" />
              <ShippingMethodRow method={method} order={order} labels={l} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ShippingMethodRow({
  method,
  order,
  labels,
}: {
  method: HttpTypes.StoreOrderShippingMethod
  order: HttpTypes.StoreOrder
  labels: Pick<OrderLabels, "free">
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <Truck className="w-[18px] h-[18px] text-muted-foreground" />
        </div>
        <span className="text-sm text-foreground">{method.name}</span>
      </div>
      {(method.total ?? 0) === 0 ? (
        <span className="text-sm font-medium text-success">{labels.free}</span>
      ) : (
        <DualPrice
          amount={method.total ?? 0}
          currencyCode={order.currency_code}
          className="text-sm font-medium text-foreground"
        />
      )}
    </div>
  )
}

export { type OrderDeliveryCardProps }
