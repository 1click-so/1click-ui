"use client"

import type { HttpTypes } from "@medusajs/types"
import { PaymentElement } from "@stripe/react-stripe-js"
import type { StripePaymentElementChangeEvent } from "@stripe/stripe-js"
import { useContext } from "react"

import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"
import { ErrorMessage } from "./error-message"
import { PaymentButton } from "./payment-button"
import { StripeContext } from "./stripe-wrapper"

/**
 * CheckoutPaymentMethodList — online-payment vs cash-on-delivery radio
 * list. The online tab hosts Stripe's `<PaymentElement />` in accordion
 * layout, which renders every payment method enabled in the Stripe
 * Dashboard (card, Apple Pay, Google Pay, Link, etc.) without any
 * per-method code here.
 *
 * COD stays a separate rail — it's a Medusa "manual" provider, not a
 * Stripe payment method.
 *
 * Extracted from mindpages-storefront checkout-client/index.tsx and
 * migrated from Card Element to Payment Element per Medusa's official
 * Stripe customization guide
 * (docs.medusajs.com/resources/nextjs-starter/guides/customize-stripe).
 */

type CheckoutPaymentMethodListProps = {
  cart: HttpTypes.StoreCart
  hasCard: boolean
  hasCod: boolean
  paymentTab: "card" | "cod"
  onPaymentTab: (tab: "card" | "cod") => void
  deliveryReady: boolean
  paymentError: string | null
  /** Fired when the Stripe PaymentElement's completion state changes.
   * `complete === true` means the user has filled in valid details for
   * the currently selected method and the Place Order button can enable. */
  onPaymentElementChange: (event: {
    complete: boolean
    selectedMethod: string | null
  }) => void
  /** Optional content rendered directly above the Place Order button.
   * Used by CheckoutClient to slot the mobile order-summary bottom bar. */
  beforePaymentButton?: React.ReactNode
}

export function CheckoutPaymentMethodList({
  cart,
  hasCard,
  hasCod,
  paymentTab,
  onPaymentTab,
  deliveryReady,
  paymentError,
  onPaymentElementChange,
  beforePaymentButton,
}: CheckoutPaymentMethodListProps) {
  const labels = useCheckoutLabels()
  const stripeReady = useContext(StripeContext)

  const handlePaymentElementChange = (event: StripePaymentElementChangeEvent) => {
    onPaymentElementChange({
      complete: event.complete,
      selectedMethod: event.value?.type ?? null,
    })
  }

  return (
    <div
      className={cn(
        "mt-8 transition-opacity duration-300",
        !deliveryReady && "opacity-30 pointer-events-none select-none"
      )}
    >
      <h2 className="text-lg font-semibold text-foreground mb-1 tracking-tight">
        {labels.paymentMethod}
      </h2>
      <p className="text-xs text-muted-foreground mb-4">{labels.termsText}</p>

      {!deliveryReady ? (
        <div className="p-4 bg-muted rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">{labels.paymentDisabled}</p>
        </div>
      ) : hasCard && !hasCod ? (
        // Single-method collapse (card only). Drop the radio header —
        // there's nothing to choose between — and render PaymentElement
        // directly inside the selected-state border. Session is already
        // auto-initiated upstream (CheckoutClient `useEffect` on
        // deliveryReady), so the card form is live without any click.
        <div className="rounded-lg border border-primary bg-primary/5 overflow-hidden">
          {!stripeReady && (
            <div className="px-4 py-4 space-y-2.5 animate-pulse">
              <div className="h-[44px] rounded-lg bg-muted" />
              <div className="grid grid-cols-2 gap-2.5">
                <div className="h-[44px] rounded-lg bg-muted" />
                <div className="h-[44px] rounded-lg bg-muted" />
              </div>
            </div>
          )}
          {stripeReady && (
            <div className="px-4 py-4">
              <PaymentElement
                onChange={handlePaymentElementChange}
                options={{
                  layout: "accordion",
                  fields: { billingDetails: { address: "never" } },
                }}
              />
            </div>
          )}
        </div>
      ) : hasCod && !hasCard ? (
        // Single-method collapse (COD only). Same logic — radio header
        // is redundant; render the note directly.
        <div className="rounded-lg border border-primary bg-primary/5 overflow-hidden">
          <div className="px-4 py-4">
            <p className="text-sm font-medium text-foreground">
              {labels.cashOnDelivery}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {labels.codNote}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {hasCard && (
              <div
                className={cn(
                  "rounded-lg border overflow-hidden transition-colors duration-150",
                  paymentTab === "card"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-muted-foreground"
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
                      paymentTab === "card" ? "border-primary" : "border-border"
                    )}
                  >
                    {paymentTab === "card" && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {labels.payOnline}
                  </span>
                </button>

                {paymentTab === "card" && !stripeReady && (
                  <div className="px-4 pb-4 pt-2 space-y-2.5 animate-pulse">
                    <div className="h-[44px] rounded-lg bg-muted" />
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="h-[44px] rounded-lg bg-muted" />
                      <div className="h-[44px] rounded-lg bg-muted" />
                    </div>
                  </div>
                )}
                {paymentTab === "card" && stripeReady && (
                  <div className="px-4 pb-4 pt-2">
                    <PaymentElement
                      onChange={handlePaymentElementChange}
                      options={{
                        layout: "accordion",
                        fields: { billingDetails: { address: "never" } },
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {hasCod && (
              <div
                className={cn(
                  "rounded-lg border overflow-hidden transition-colors duration-150",
                  paymentTab === "cod"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-muted-foreground"
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
                      paymentTab === "cod" ? "border-primary" : "border-border"
                    )}
                  >
                    {paymentTab === "cod" && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {labels.cashOnDelivery}
                  </span>
                </button>
                {paymentTab === "cod" && (
                  <div className="px-4 pb-3 pt-0">
                    <p className="text-xs text-muted-foreground ml-[30px]">
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

          {beforePaymentButton && (
            <div className="mt-5">{beforePaymentButton}</div>
          )}

          <div className="mt-5">
            <PaymentButton cart={cart} data-testid="submit-order-button" />
          </div>
        </>
      )}
    </div>
  )
}
