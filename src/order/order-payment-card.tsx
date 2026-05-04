import type { HttpTypes } from "@medusajs/types"
import { CreditCard } from "lucide-react"
import {
  isManual,
  isPaypal,
  isStripeLike,
  paymentInfoMap,
} from "../lib/payment-constants"
import { defaultOrderLabels, type OrderLabels } from "./labels"

type OrderPaymentCardProps = {
  order: HttpTypes.StoreOrder
  labels?: Pick<OrderLabels, "paymentMethod" | "paymentMethodTitles">
}

/**
 * Resolve a human-readable, locale-correct title for a payment session's
 * provider id. Resolution order:
 *
 *   1. Bucketed lookup against `labels.paymentMethodTitles` (the locale
 *      pack the storefront passes in). This is the canonical localization
 *      surface — Bulgarian stores get "Наложен платеж" here, English
 *      stores get "Cash on delivery", etc.
 *   2. Hardcoded `paymentInfoMap` fallback for known provider ids (English
 *      defaults). Keeps the library safe for storefronts that haven't
 *      adopted the labels pack yet.
 *   3. The raw provider id as a last resort, so the card never renders
 *      empty if a brand-new provider lands.
 *
 * The bucket is determined by the same `isStripeLike` / `isManual` /
 * `isPaypal` predicates used everywhere else in the library, so a single
 * change to those (e.g. when a new Stripe wrapper provider id is added)
 * propagates here automatically.
 */
function resolvePaymentTitle(
  providerId: string | undefined,
  paymentMethodTitles: OrderLabels["paymentMethodTitles"]
): string {
  if (!providerId) return ""
  if (isStripeLike(providerId)) return paymentMethodTitles.card
  if (isManual(providerId)) return paymentMethodTitles.cod
  if (isPaypal(providerId)) return paymentMethodTitles.paypal
  return paymentInfoMap[providerId]?.title ?? providerId
}

export function OrderPaymentCard({ order, labels }: OrderPaymentCardProps) {
  const l = { ...defaultOrderLabels, ...labels }
  const payment = order.payment_collections?.[0]?.payments?.[0]

  if (!payment) return null

  const title = resolvePaymentTitle(payment.provider_id, l.paymentMethodTitles)
  const icon = paymentInfoMap[payment.provider_id]?.icon ?? null

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        {l.paymentMethod}
      </h3>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
          {icon || <CreditCard className="w-[18px] h-[18px]" />}
        </div>
        <div>
          <p className="text-sm text-foreground">{title}</p>
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
