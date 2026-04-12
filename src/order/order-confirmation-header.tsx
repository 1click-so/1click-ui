import type { HttpTypes } from "@medusajs/types"
import { Check } from "lucide-react"
import { defaultOrderLabels, type OrderLabels } from "./labels"

type OrderConfirmationHeaderProps = {
  order: HttpTypes.StoreOrder
  labels?: OrderLabels
  locale?: string
}

export function OrderConfirmationHeader({
  order,
  labels,
  locale = "en-US",
}: OrderConfirmationHeaderProps) {
  const l = { ...defaultOrderLabels, ...labels }
  const orderDate = new Date(order.created_at).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="text-center pt-8 pb-4 sm:pt-10 sm:pb-5">
      <div className="mx-auto mb-5 w-[72px] h-[72px] rounded-full bg-success flex items-center justify-center">
        <Check className="w-9 h-9 text-white" strokeWidth={2.5} />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-2">
        {l.orderConfirmed}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {l.confirmationSent}{" "}
        <span className="font-medium text-foreground">{order.email}</span>
      </p>

      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
          <span className="text-xs text-muted-foreground">{l.orderNumber}</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            #{order.display_id}
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
          <span className="text-xs text-muted-foreground">{l.orderDate}</span>
          <span className="text-sm font-medium text-foreground">{orderDate}</span>
        </div>
      </div>
    </div>
  )
}

export { type OrderConfirmationHeaderProps }
