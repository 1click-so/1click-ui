import type { HttpTypes } from "@medusajs/types"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { defaultOrderLabels, type OrderLabels } from "./labels"
import { OrderConfirmationHeader } from "./order-confirmation-header"
import { OrderTimeline } from "./order-timeline"
import { OrderItemsList } from "./order-items-list"
import { OrderTotals } from "./order-totals"
import { OrderAddressCard } from "./order-address-card"
import { OrderDeliveryCard } from "./order-delivery-card"
import { OrderPaymentCard } from "./order-payment-card"
import { OrderHelpSection } from "./order-help-section"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
  labels?: OrderLabels
  locale?: string
  contactHref?: string
  returnsHref?: string
  /**
   * Admin-editable label for the cash-on-delivery fee row in the totals
   * breakdown. Optional — falls back to the fee line item's title, then
   * to the translated `labels.codFee` default.
   */
  codFeeLabel?: string
}

export function OrderCompletedTemplate({
  order,
  labels,
  locale,
  contactHref,
  returnsHref,
  codFeeLabel,
}: OrderCompletedTemplateProps) {
  const l = { ...defaultOrderLabels, ...labels }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-muted/50 py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4">
        <OrderConfirmationHeader order={order} labels={l} locale={locale} />

        <div className="mb-6 mt-6">
          <OrderTimeline
            fulfillmentStatus={order.fulfillment_status}
            labels={l}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-card rounded-xl p-5 sm:p-6 shadow-sm">
              <OrderItemsList order={order} labels={l} />
              <OrderTotals order={order} labels={l} codFeeLabel={codFeeLabel} />
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            <OrderAddressCard order={order} labels={l} />
            <OrderDeliveryCard order={order} labels={l} />
            <OrderPaymentCard order={order} labels={l} />
            <OrderHelpSection
              labels={l}
              contactHref={contactHref}
              returnsHref={returnsHref}
            />
          </div>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/store"
            className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-card text-sm font-semibold rounded-xl hover:opacity-90 active:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4" />
            {l.continueShopping}
          </Link>
        </div>
      </div>
    </div>
  )
}

export { type OrderCompletedTemplateProps }
