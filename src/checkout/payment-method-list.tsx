"use client"

import type { HttpTypes } from "@medusajs/types"
import { PaymentElement } from "@stripe/react-stripe-js"
import type { StripePaymentElementChangeEvent } from "@stripe/stripe-js"
import { useRouter } from "next/navigation"
import { useContext, useEffect, useRef, useState } from "react"

import { logCheckoutError, refreshPaymentIfTerminal } from "../data/cart"
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
  const router = useRouter()
  // Boolean context — true when the cart's pending session is Stripe-
  // backed AND has a usable client_secret. Used to gate the inner
  // PaymentElement skeleton vs the real element. Same value
  // StripeElementsScope reads from useStripeScope().
  const stripeReady = useContext(StripeContext)

  // Local copy of Stripe's PaymentElement completion flag. The same
  // value is forwarded to the parent via `onPaymentElementChange`, but
  // we keep an internal copy so the Place Order button can be gated
  // here without making consumers thread the state down themselves.
  const [paymentElementComplete, setPaymentElementComplete] = useState(false)

  // One-shot guard against the rotate-and-refresh loop. The previous
  // implementation reloaded on every terminal-state error which, when
  // the new PI ALSO hit a transient issue, looped. We only attempt
  // recovery ONCE per (clientSecret, paymentTab) combination — a fresh
  // client_secret after rotation is a new opportunity to recover, but
  // a repeated terminal state on the SAME secret means the rotation
  // didn't help and we'd loop.
  //
  // The clientSecret reset is keyed off the cart's pending payment
  // session — it changes whenever the session rotates. Since Elements
  // is now scoped to just the PaymentElement (StripeElementsScope),
  // this component does NOT remount on rotation; the ref persists
  // across rotations and we have to clear it explicitly.
  const recoveryAttempted = useRef(false)
  const currentClientSecret = (
    cart.payment_collection?.payment_sessions?.find(
      (s) => s.status === "pending"
    )?.data as { client_secret?: string } | undefined
  )?.client_secret

  // Reset on tab change OR when clientSecret rotates. PaymentElement
  // only renders while `paymentTab === "card"`, so when the user
  // switches away the element unmounts and the flag must drop to false
  // — otherwise switching back to a fresh (empty) PaymentElement would
  // leave the button erroneously enabled from the previous fill.
  useEffect(() => {
    setPaymentElementComplete(false)
    recoveryAttempted.current = false
  }, [paymentTab, currentClientSecret])

  const handlePaymentElementChange = (event: StripePaymentElementChangeEvent) => {
    setPaymentElementComplete(event.complete)
    onPaymentElementChange({
      complete: event.complete,
      selectedMethod: event.value?.type ?? null,
    })
  }

  // PaymentElement load error handler — reactive recovery for stale
  // Stripe PaymentIntents.
  //
  // The cart's payment_session can hold a client_secret pointing at a
  // PI in terminal state (canceled / succeeded / requires_capture).
  // This happens because Medusa's payment-webhook subscriber explicitly
  // drops `payment_intent.canceled` and `payment_intent.payment_failed`
  // events (see node_modules/@medusajs/medusa/dist/subscribers/
  // payment-webhook.js lines 17-23), so the session record never moves
  // off "pending" even after Stripe declares the PI dead. Mounting
  // Elements with that dead client_secret triggers Stripe's:
  //   "PaymentIntent is in a terminal state and cannot be used to
  //    initialize Elements."
  //
  // Recovery: ask the backend to reconcile against Stripe and rotate
  // the session if the PI is actually terminal. On success, refresh
  // the route — the server component re-fetches the cart, gets the
  // fresh client_secret, PaymentWrapper remounts Elements with it.
  //
  // Loop safety:
  //   1. ONE attempt per Elements mount (recoveryAttempted ref).
  //      A previous version rotated on every terminal-state error
  //      including ones the rotation couldn't fix → infinite loop.
  //   2. We ONLY trigger when the error message indicates a terminal
  //      state. Other PaymentElement load errors (network, missing
  //      payment methods, config) get logged and left alone.
  //   3. The backend only rotates when Stripe confirms terminal state.
  //      Transient Stripe errors → backend returns rotated:false → no
  //      refresh, no loop.
  const handlePaymentElementLoadError = (event: { error?: { message?: string } }) => {
    const message = event?.error?.message ?? ""

    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn("[PaymentElement] load error:", message || event)
    }

    // Log every load error to the backend so we have operational
    // visibility on which carts are hitting which Stripe Elements
    // failures. Append-only, write-only from storefront perspective.
    const isTerminalStateError = /terminal state/i.test(message)
    void logCheckoutError("elements_load_error", message, {
      is_terminal_state: isTerminalStateError,
      will_attempt_recovery:
        isTerminalStateError && !recoveryAttempted.current,
    })

    if (!isTerminalStateError) return
    if (recoveryAttempted.current) return
    recoveryAttempted.current = true

    void (async () => {
      try {
        const result = await refreshPaymentIfTerminal(cart.id)
        if (result.rotated) {
          // Re-render the server component to pull the fresh cart with
          // the rotated session's new client_secret. PaymentWrapper
          // will remount Elements once the new prop arrives.
          router.refresh()
        }
      } catch {
        // Server action failed — leave the user on the error state.
        // They can manually reload; we won't loop.
      }
    })()
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
                          fields: { billingDetails: { address: "never" } },
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
        </StripeElementsScope>
      )}
    </div>
  )
}
