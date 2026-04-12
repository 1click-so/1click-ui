import type { HttpTypes } from "@medusajs/types"
import { CreditCard } from "lucide-react"
import { isStripeLike, paymentInfoMap } from "../lib/payment-constants"
import { defaultOrderLabels, type OrderLabels } from "./labels"

type OrderPaymentCardProps = {
  order: HttpTypes.StoreOrder
  labels?: Pick<OrderLabels, "paymentMethod">
}

export function OrderPaymentCard({ order, labels }: OrderPaymentCardProps) {
  const l = { ...defaultOrderLabels, ...labels }
  const payment = order.payment_collections?.[0]?.payments?.[0]

  if (!payment) return null

  const info = paymentInfoMap[payment.provider_id] || {
    title: payment.provider_id,
    icon: null,
  }

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        {l.paymentMethod}
      </h3>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
          {info.icon || <CreditCard className="w-[18px] h-[18px]" />}
        </div>
        <div>
          <p className="text-sm text-foreground">{info.title}</p>
          {isStripeLike(payment.provider_id) &&
            (payment as any).data?.card_last4 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                **** **** **** {(payment as any).data.card_last4}
              </p>
            )}
        </div>
      </div>
    </div>
  )
}

export { type OrderPaymentCardProps }
