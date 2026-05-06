"use client"

import type { HttpTypes } from "@medusajs/types"
import { PaymentElement } from "@stripe/react-stripe-js"
import type { StripePaymentElementChangeEvent } from "@stripe/stripe-js"
import { useContext, useEffect, useState } from "react"

import { logCheckoutError } from "../data/cart"
import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"
import { ErrorMessage } from "./error-message"
import { PaymentButton } from "./payment-button"
import { StripeContext, StripeElementsScope } from "./stripe-wrapper"

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
  /** Buy-click flow from `useCheckoutOrchestration`. Wraps prepareCheckout
   * → stripe.confirmPayment (card) → placeOrder. The button collects
   * the local Stripe primitives and passes them in. */
  performBuyClick: (stripeBundle?: {
    submit: () => Promise<{ error?: { message?: string } | null }>
    stripe: {
      confirmPayment: (args: {
        elements: unknown
        clientSecret: string
        confirmParams: { return_url: string }
        redirect: "if_required"
      }) => Promise<{ error?: { message?: string } | null }>
    }
    elements: unknown
  }) => Promise<void>
  /** True when address + shipping + carrier-destination are all filled.
   * Needed to gate the Buy button alongside Stripe-element completion. */
  buyButtonNotReady: boolean
  /** Optional content rendered directly above the Place Order button.
   * Used by CheckoutClient to slot the mobile order-summary bottom bar. */
  beforePaymentButton?: React.ReactNode
  /** Display total in main currency units. Forwarded to `PaymentButton`.
   * Pass `useCheckoutOrchestration`'s `optimisticTotal` so the button
   * shows the same number as the order summary. Falls back to
   * `cart.total` when omitted. */
  total?: number
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
  performBuyClick,
  buyButtonNotReady,
  beforePaymentButton,
  total,
}: CheckoutPaymentMethodListProps) {
  const labels = useCheckoutLabels()
  // Boolean context — true when Stripe.js is loaded. In deferred-intent
  // mode, the iframe mounts as soon as Stripe is ready (no PI required).
  const stripeReady = useContext(StripeContext)

  // Local copy of Stripe's PaymentElement completion flag. Forwarded
  // to the parent via `onPaymentElementChange` AND used here to gate
  // the Buy button on the card path.
  const [paymentElementComplete, setPaymentElementComplete] = useState(false)

  // Reset completion flag on tab change. PaymentElement is unmounted
  // when paymentTab !== "card" so a re-mount starts empty — without
  // this reset, switching away then back would leave the button
  // erroneously enabled from a previous fill.
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

  // PaymentElement load error handler — log only.
  //
  // In the eager-session model this used to call `refreshPaymentIfTerminal`
  // because the cart could hold a stale client_secret pointing at a
  // terminal Stripe PaymentIntent. In the deferred-intent model the PI
  // is created at Buy click, so there's no stale-PI failure mode at
  // mount time. We keep the logger to capture any other load issues
  // (key misconfiguration, network, etc).
  const handlePaymentElementLoadError = (event: {
    error?: { message?: string }
  }) => {
    const message = event?.error?.message ?? ""
    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn("[PaymentElement] load error:", message || event)
    }
    void logCheckoutError("elements_load_error", message, {})
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
        // ── Stripe Elements scope ──────────────────────────────────────
        // Wraps the entire interactive payment section (radio cards +
        // PaymentElement + PaymentButton) so `<StripePaymentButton>`'s
        // useStripe()/useElements() hooks find an <Elements> ancestor.
        //
        // `passthrough` matters: COD-only carts have no Stripe session
        // and no client_secret, so <Elements> can't mount. Without
        // passthrough the wrapper would render `null` (its default
        // fallback) and the COD radio + ManualPaymentButton would
        // disappear entirely — checkout dead for COD users. With
        // passthrough, when Stripe isn't ready we render children
        // directly (no <Elements>); ManualPaymentButton doesn't use
        // Stripe hooks so it works fine without context.
        //
        // Critically, this scope is INSIDE CheckoutPaymentMethodList,
        // not at the checkout root. When the payment session rotates
        // and a new client_secret arrives, only this section remounts
        // — the orchestration tree, address form, shipping selector,
        // and tracking refs upstream are NOT torn down. That's the
        // whole point of moving away from PaymentWrapper-wraps-all.
        <StripeElementsScope passthrough>
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

                {paymentTab === "card" && (
                  <div className="px-4 pb-4 pt-2">
                    {/*
                      Skeleton vs PaymentElement gated by stripeReady.
                      When ready=true we're inside <Elements> (outer
                      passthrough scope mounted it) and PaymentElement
                      can render. When ready=false (Stripe still
                      initialising) we show the skeleton — rendering
                      PaymentElement without an <Elements> ancestor
                      throws.
                    */}
                    {stripeReady ? (
                      <PaymentElement
                        onChange={handlePaymentElementChange}
                        onLoadError={handlePaymentElementLoadError}
                        options={{
                          layout: "accordion",
                          // Intentionally NO `fields.billingDetails.address`
                          // override. Setting it to "never" puts Stripe into
                          // strict-completeness mode — every billing-details
                          // sub-field MUST be passed in confirmParams or it
                          // throws an IntegrationError naming the first
                          // missing one (country → state → next). For card-
                          // only payment methods (Card / Apple Pay / Google
                          // Pay — alenika's only enabled methods), Stripe
                          // doesn't show address fields by default, so
                          // dropping the override has zero UI impact and
                          // eliminates the IntegrationError class entirely.
                          // We still pass full billing_details to
                          // stripe.confirmPayment for AVS / Radar / 3DS
                          // risk scoring / dispute defense.
                        }}
                      />
                    ) : (
                      <div className="space-y-2.5 animate-pulse">
                        <div className="h-[44px] rounded-lg bg-muted" />
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="h-[44px] rounded-lg bg-muted" />
                          <div className="h-[44px] rounded-lg bg-muted" />
                        </div>
                      </div>
                    )}
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
            <PaymentButton
              cart={cart}
              paymentTab={paymentTab}
              notReady={buyButtonNotReady}
              performBuyClick={performBuyClick}
              paymentElementComplete={
                paymentTab === "cod" ? true : paymentElementComplete
              }
              total={total}
              data-testid="submit-order-button"
            />
          </div>
        </StripeElementsScope>
      )}
    </div>
  )
}
