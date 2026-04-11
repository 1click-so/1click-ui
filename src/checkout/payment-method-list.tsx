"use client"

import type { HttpTypes } from "@medusajs/types"
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
} from "@stripe/react-stripe-js"
import type { StripeCardNumberElementOptions } from "@stripe/stripe-js"
import { useContext, useMemo } from "react"

import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"
import { ErrorMessage } from "./error-message"
import { PaymentButton } from "./payment-button"
import { StripeContext } from "./stripe-wrapper"

/**
 * CheckoutPaymentMethodList — card vs cash-on-delivery radio list with
 * Stripe card fields expanded inline when the card option is selected,
 * plus the `PaymentButton` that places the order.
 *
 * Presentational — state + handlers come from parent CheckoutClient.
 *
 * Extracted from mindpages-storefront checkout-client/index.tsx — the
 * `Начин на плащане` section (roughly lines 1010-1170).
 */

type CheckoutPaymentMethodListProps = {
  cart: HttpTypes.StoreCart
  hasCard: boolean
  hasCod: boolean
  paymentTab: "card" | "cod"
  onPaymentTab: (tab: "card" | "cod") => void
  deliveryReady: boolean
  paymentError: string | null
  onCardChange: (e: {
    complete: boolean
    error?: { message?: string }
    brand?: string
  }) => void
  onCardFieldError: (message: string | null) => void
}

const stripeElementStyle: StripeCardNumberElementOptions["style"] = {
  base: {
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#111827",
    fontSize: "14px",
    "::placeholder": { color: "#9CA3AF" },
  },
  invalid: { color: "#dc2626" },
}

export function CheckoutPaymentMethodList({
  cart,
  hasCard,
  hasCod,
  paymentTab,
  onPaymentTab,
  deliveryReady,
  paymentError,
  onCardChange,
  onCardFieldError,
}: CheckoutPaymentMethodListProps) {
  const labels = useCheckoutLabels()
  const stripeReady = useContext(StripeContext)

  const style = useMemo(() => stripeElementStyle, [])

  return (
    <div
      className={cn(
        "mt-8 transition-opacity duration-300",
        !deliveryReady && "opacity-30 pointer-events-none select-none"
      )}
    >
      <h2 className="text-lg font-semibold text-text-base mb-1 tracking-tight">
        {labels.paymentMethod}
      </h2>
      <p className="text-xs text-text-muted mb-4">{labels.termsText}</p>

      {!deliveryReady ? (
        <div className="p-4 bg-surface-muted rounded-lg border border-border">
          <p className="text-sm text-text-muted">{labels.paymentDisabled}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {hasCard && (
              <div
                className={cn(
                  "rounded-lg border overflow-hidden transition-colors duration-150",
                  paymentTab === "card"
                    ? "border-accent bg-accent/5"
                    : "border-border bg-surface hover:border-text-subtle"
                )}
              >
                <button
                  type="button"
                  onClick={() => onPaymentTab("card")}
                  className="flex items-center w-full px-4 py-3.5 text-left"
                >
                  <div
                    className={cn(
                      "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mr-3 transition-colors",
                      paymentTab === "card" ? "border-accent" : "border-border"
                    )}
                  >
                    {paymentTab === "card" && (
                      <div className="w-2 h-2 rounded-full bg-accent" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-text-base">
                    {labels.payByCard}
                  </span>
                </button>

                {paymentTab === "card" && !stripeReady && (
                  <div className="px-4 pb-4 pt-2 space-y-2.5 animate-pulse">
                    <div className="h-[44px] rounded-lg bg-surface-muted" />
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="h-[44px] rounded-lg bg-surface-muted" />
                      <div className="h-[44px] rounded-lg bg-surface-muted" />
                    </div>
                  </div>
                )}
                {paymentTab === "card" && stripeReady && (
                  <div className="px-4 pb-4 pt-2 space-y-2.5">
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">
                        {labels.cardNumber}
                      </label>
                      <div className="h-[44px] px-3 pt-[10px] border border-border rounded-lg bg-surface hover:border-text-subtle focus-within:border-accent focus-within:bg-accent/5 transition-all">
                        <CardNumberElement
                          options={{ style, showIcon: true }}
                          onChange={(e) =>
                            onCardChange({
                              complete: e.complete,
                              error: e.error,
                              brand: e.brand,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-xs text-text-muted mb-1 block">
                          {labels.cardExpiry}
                        </label>
                        <div className="h-[44px] px-3 pt-[10px] border border-border rounded-lg bg-surface hover:border-text-subtle focus-within:border-accent focus-within:bg-accent/5 transition-all">
                          <CardExpiryElement
                            options={{ style }}
                            onChange={(e) => {
                              if (e.error)
                                onCardFieldError(e.error.message ?? null)
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-text-muted mb-1 block">
                          {labels.cardCvc}
                        </label>
                        <div className="h-[44px] px-3 pt-[10px] border border-border rounded-lg bg-surface hover:border-text-subtle focus-within:border-accent focus-within:bg-accent/5 transition-all">
                          <CardCvcElement
                            options={{ style }}
                            onChange={(e) => {
                              if (e.error)
                                onCardFieldError(e.error.message ?? null)
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {hasCod && (
              <div
                className={cn(
                  "rounded-lg border overflow-hidden transition-colors duration-150",
                  paymentTab === "cod"
                    ? "border-accent bg-accent/5"
                    : "border-border bg-surface hover:border-text-subtle"
                )}
              >
                <button
                  type="button"
                  onClick={() => onPaymentTab("cod")}
                  className="flex items-center w-full px-4 py-3.5 text-left"
                >
                  <div
                    className={cn(
                      "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mr-3 transition-colors",
                      paymentTab === "cod" ? "border-accent" : "border-border"
                    )}
                  >
                    {paymentTab === "cod" && (
                      <div className="w-2 h-2 rounded-full bg-accent" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-text-base">
                    {labels.cashOnDelivery}
                  </span>
                </button>
                {paymentTab === "cod" && (
                  <div className="px-4 pb-3 pt-0">
                    <p className="text-xs text-text-muted ml-[30px]">
                      {labels.codNote}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <ErrorMessage
            error={paymentError}
            data-testid="payment-error-message"
          />

          <div className="mt-5">
            <PaymentButton cart={cart} data-testid="submit-order-button" />
          </div>
        </>
      )}
    </div>
  )
}
