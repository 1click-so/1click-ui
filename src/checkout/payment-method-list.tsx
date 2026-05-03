"use client"

import type { HttpTypes } from "@medusajs/types"
import { PaymentElement } from "@stripe/react-stripe-js"
import type { StripePaymentElementChangeEvent } from "@stripe/stripe-js"
import { useContext, useEffect, useRef, useState } from "react"

import { refreshPaymentIfTerminal } from "../data/cart"
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

  // Local copy of Stripe's PaymentElement completion flag. The same
  // value is forwarded to the parent via `onPaymentElementChange`, but
  // we keep an internal copy so the Place Order button can be gated
  // here without making consumers thread the state down themselves.
  const [paymentElementComplete, setPaymentElementComplete] = useState(false)

  // Reset on tab change. PaymentElement only renders while
  // `paymentTab === "card"`, so when the user switches away the element
  // unmounts and the flag must drop to false — otherwise switching
  // back to a fresh (empty) PaymentElement would leave the button
  // erroneously enabled from the previous fill.
  useEffect(() => {
    setPaymentElementComplete(false)
  }, [paymentTab])

  const handlePaymentElementChange = (event: StripePaymentElementChangeEvent) => {
    setPaymentElementComplete(event.complete)
    onPaymentElementChange({
      complete: event.complete,
      selectedMethod: event.value?.type ?? null,
    })
  }

  // Defense-in-depth: server-side refreshPaymentIfTerminal in
  // checkout/page.tsx is the primary line of defense against stale
  // PaymentIntents. This handler covers the rare edge case where the PI
  // goes terminal AFTER the page rendered (admin cancels via Dashboard
  // mid-checkout, or the same cart in another tab). On loaderror we
  // reconcile and reload — the next render mounts on a fresh
  // client_secret. One-shot per element instance to prevent reload loops.
  const recoveredRef = useRef(false)
  const handlePaymentElementLoadError = (event: { error?: { message?: string } }) => {
    const msg = event?.error?.message ?? ""
    const isTerminalLike = /terminal state|payment[_ ]?intent.*(?:canceled|succeeded)/i.test(msg)
    if (recoveredRef.current || !isTerminalLike) return
    recoveredRef.current = true
    refreshPaymentIfTerminal(cart.id)
      .then((r) => {
        if (r.rotated && typeof window !== "undefined") {
          window.location.reload()
        }
      })
      .catch(() => {})
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
                      onLoadError={handlePaymentElementLoadError}
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
            {/*
              For card we forward the live PaymentElement completion flag
              so the button stays disabled until the user has filled in
              valid details (or Stripe Elements managed to initialise at
              all). For COD the flag is irrelevant — pass `true` so the
              button gates only on cart-level prerequisites.
            */}
            <PaymentButton
              cart={cart}
              paymentElementComplete={
                paymentTab === "cod" ? true : paymentElementComplete
              }
              data-testid="submit-order-button"
            />
          </div>
        </>
      )}
    </div>
  )
}
