"use client"

import type { HttpTypes } from "@medusajs/types"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import { useContext, useRef, useState } from "react"

import { DualPrice } from "../lib/dual-price"
import { cn } from "../lib/utils"
import { translatePaymentError } from "./payment-error-copy"
import { useCheckoutLabels } from "./context"
import { ErrorMessage } from "./error-message"
import { StripeContext } from "./stripe-wrapper"

/**
 * PaymentButton — top-level "place order" button.
 *
 * As of the deferred-checkout architecture (see consuming store's
 * docs/checkout-architecture.md), this button delegates entirely to the
 * orchestration hook's `performBuyClick` callback. The button knows
 * NOTHING about how the order is placed; it just gathers the local
 * Stripe primitives (when on the card tab) and hands them off.
 *
 * The flow that runs on click:
 *   1. orchestration.performBuyClick({ submit, stripe, elements })
 *      - flushAddressSave()
 *      - (card) elements.submit()
 *      - prepareCheckout(...)        ← writes everything atomically
 *      - (card) stripe.confirmPayment ← may redirect for 3DS
 *      - placeOrder()                 ← Medusa cart.complete
 *
 * The button is always rendered inside `<StripeElementsScope>` so
 * `useStripe()`/`useElements()` resolve when the scope is active. On
 * COD-only carts (no Stripe key) the scope passes through and the
 * stripe/elements hooks return null — the COD path skips all Stripe
 * work, so that's fine.
 */

type BuyClickStripeBundle = {
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
}

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  paymentTab: "card" | "cod"
  notReady: boolean
  performBuyClick: (stripeBundle?: BuyClickStripeBundle) => Promise<void>
  /**
   * Set to the live `event.complete` boolean from Stripe's
   * `<PaymentElement onChange>`. When `false` on the card path, the Buy
   * button stays disabled even when cart-level prerequisites are met,
   * preventing the click → cryptic "Could not retrieve elements store"
   * failure when the user hasn't filled in payment details.
   *
   * Ignored on the COD path. Defaults to `true`.
   */
  paymentElementComplete?: boolean
  "data-testid"?: string
}

function OrderButton({
  onClick,
  disabled,
  loading,
  total,
  currencyCode,
  testId,
  label,
}: {
  onClick: () => void
  disabled: boolean
  loading: boolean
  total?: number
  currencyCode?: string
  testId?: string
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "w-full h-14 bg-foreground text-card text-base font-semibold rounded-xl",
        "flex items-center justify-center gap-2.5 transition-all",
        "hover:bg-foreground/90 active:scale-[0.99]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-foreground"
      )}
    >
      {loading ? (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <>
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="inline-flex items-center gap-1.5">
            {label}
            {total !== undefined && currencyCode && (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true"> · </span>
                <DualPrice
                  amount={total}
                  currencyCode={currencyCode}
                  className="font-semibold"
                  bgnClassName="text-card/70 text-[11px] ml-1"
                />
              </span>
            )}
          </span>
        </>
      )}
    </button>
  )
}

export function PaymentButton({
  cart,
  paymentTab,
  notReady,
  performBuyClick,
  paymentElementComplete = true,
  "data-testid": dataTestId,
}: PaymentButtonProps) {
  const labels = useCheckoutLabels()
  const stripeReady = useContext(StripeContext)
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Hard re-entry guard. `submitting` state alone isn't enough: React
  // batches state updates so two synchronous clicks both pass the
  // submitting check before the first one's setState commits. A ref
  // flips synchronously and blocks the second click cold.
  const inFlightRef = useRef(false)

  const isCardPath = paymentTab === "card"
  const cardReady = !isCardPath || (stripeReady && !!stripe && !!elements)
  const cardComplete = !isCardPath || paymentElementComplete

  const disabled = notReady || !cardReady || !cardComplete || submitting

  const handleClick = async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const stripeBundle: BuyClickStripeBundle | undefined =
        isCardPath && stripe && elements
          ? {
              submit: () => elements.submit(),
              stripe: stripe as unknown as BuyClickStripeBundle["stripe"],
              elements,
            }
          : undefined

      await performBuyClick(stripeBundle)

      // performBuyClick redirects on success (placeOrder → next/redirect).
      // If we get here without a redirect Stripe returned a non-terminal
      // status (processing, requires_action without auto-redirect, etc.)
      // — release the lock so the user can retry.
      inFlightRef.current = false
      setSubmitting(false)
    } catch (err: unknown) {
      // Next.js's `redirect()` from a server action throws a NEXT_REDIRECT
      // error — that is success, not failure. Don't translate it; let it
      // propagate so the navigation actually happens.
      const e = err as { digest?: string; message?: string }
      const isNextRedirect =
        typeof e?.digest === "string" && e.digest.startsWith("NEXT_REDIRECT")
      if (isNextRedirect) {
        throw err
      }

      // eslint-disable-next-line no-console
      console.error("[buy-click] FAILED", {
        message: e?.message,
        raw: err,
      })

      const translated = translatePaymentError(err, isCardPath ? "card" : "cod")
      setErrorMessage(translated)
      inFlightRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <>
      <OrderButton
        onClick={handleClick}
        disabled={disabled}
        loading={submitting}
        total={cart.total ?? undefined}
        currencyCode={cart.currency_code}
        testId={dataTestId}
        label={labels.placeOrder}
      />
      <ErrorMessage
        error={errorMessage}
        data-testid={
          isCardPath
            ? "stripe-payment-error-message"
            : "manual-payment-error-message"
        }
      />
    </>
  )
}
