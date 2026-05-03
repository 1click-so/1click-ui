"use client"

import type { HttpTypes } from "@medusajs/types"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import { useContext, useRef, useState } from "react"

import { placeOrder } from "../data/cart"
import { DualPrice } from "../lib/dual-price"
import { isManual, isStripeLike } from "../lib/payment-constants"
import { cn } from "../lib/utils"
import { translatePaymentError } from "./payment-error-copy"
import { useCheckoutLabels, useOrderConfirmedPath } from "./context"
import { ErrorMessage } from "./error-message"
import { StripeContext } from "./stripe-wrapper"

/**
 * PaymentButton — top-level "place order" button. Routes to the correct
 * variant based on the cart's active payment session:
 *   - StripePaymentButton: confirms payment via Stripe's Payment Element
 *     (covers card + Apple Pay + Google Pay + Link + any wallet enabled
 *     in the Stripe Dashboard), then calls placeOrder()
 *   - ManualPaymentButton: calls placeOrder() directly (COD / offline)
 *   - Disabled fallback when no payment session is set
 *
 * Migrated from Stripe Card Element + confirmCardPayment to Payment
 * Element + confirmPayment per Medusa's official Stripe customization
 * guide. 3DS / post-auth redirects use `redirect: "if_required"` and
 * return to the current URL; the checkout page handles the return by
 * reading query params on mount (or the store implements
 * /api/capture-payment/[cartId] for a cleaner flow).
 */

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  /**
   * Set to the live `event.complete` boolean from Stripe's
   * `<PaymentElement onChange>`. When `false`, the Place Order button
   * stays disabled on the Stripe path even if every cart-level
   * prerequisite is satisfied — preventing the click → cryptic
   * "Could not retrieve elements store" failure when the user hasn't
   * actually filled in payment details, or when Stripe Elements failed
   * to initialise (e.g. malformed publishable key, network error).
   *
   * Ignored on the manual (COD) path. Defaults to `true` so consumers
   * that don't track Stripe's element state (legacy callers or stores
   * that don't render PaymentElement at all) keep their current
   * behaviour. Pass it explicitly to enable proper gating.
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
  paymentElementComplete = true,
  "data-testid": dataTestId,
}: PaymentButtonProps) {
  const labels = useCheckoutLabels()
  const stripeReady = useContext(StripeContext)

  const cartNotReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  // `[0]` is the canonical Medusa pattern — every initiatePaymentSession
  // call hard-deletes the existing session and creates a new one
  // (parallelize step in @medusajs/core-flows
  // payment-collection/workflows/create-payment-session.js), so there's
  // ever only one session per payment_collection. Verified against the
  // installed source.
  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  if (isStripeLike(paymentSession?.provider_id) && stripeReady) {
    // Stripe path: also block on PaymentElement not yet `complete`. This
    // is the gate that matters when Elements failed to initialise (bad
    // pk, network blip) — `useStripe()`/`useElements()` return non-null
    // as soon as the SDK script loads, so without this check the button
    // appears clickable and the user gets an opaque error on submit.
    return (
      <StripePaymentButton
        notReady={cartNotReady || !paymentElementComplete}
        cart={cart}
        data-testid={dataTestId}
      />
    )
  }

  if (isManual(paymentSession?.provider_id)) {
    return (
      <ManualPaymentButton
        notReady={cartNotReady}
        cart={cart}
        data-testid={dataTestId}
      />
    )
  }

  return (
    <button
      type="button"
      disabled
      className="w-full h-14 bg-muted text-muted-foreground text-base font-semibold rounded-xl cursor-not-allowed"
    >
      {labels.selectPaymentMethod}
    </button>
  )
}

function StripePaymentButton({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) {
  const labels = useCheckoutLabels()
  const orderConfirmedPath = useOrderConfirmedPath()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Hard re-entry guard. `submitting` state alone isn't enough: React
  // batches state updates so two synchronous clicks both pass the
  // submitting check before the first one's setState commits. A ref
  // flips synchronously and blocks the second click cold.
  const inFlightRef = useRef(false)

  const stripe = useStripe()
  const elements = useElements()

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  const disabled = !stripe || !elements

  const onPaymentCompleted = async () => {
    // placeOrder either redirects (success) or throws (failure). On
    // success the redirect navigates away — `submitting` stays true so
    // the spinner persists during the redirect; React will unmount this
    // component before the user sees a flash of an enabled button.
    await placeOrder(undefined, undefined, orderConfirmedPath)
      .catch((err: unknown) => {
        // Charged-card recovery: by this point Stripe has authorized
        // (PI is requires_capture or succeeded), so the customer's
        // card already has a hold or charge. We MUST surface this with
        // the PI reference so support can reconcile manually if Medusa
        // never recovers. Show in BG, never expose raw Stripe internals.
        const piRef =
          (session?.data as { id?: string } | undefined)?.id ?? "—"
        const baseMsg = translatePaymentError(err, "card")
        setErrorMessage(
          `${baseMsg} Картата ви беше успешно оторизирана, но поръчката не е финализирана. Свържете се с нас на hello@alenika.bg с код: ${piRef}`
        )
      })
      .finally(() => {
        inFlightRef.current = false
        setSubmitting(false)
      })
  }

  const handlePayment = async () => {
    if (!stripe || !elements || !cart) {
      return
    }
    // Hard re-entry guard — see ref declaration.
    if (inFlightRef.current) return
    inFlightRef.current = true

    setSubmitting(true)
    setErrorMessage(null)

    // Payment Element requires an explicit submit() before confirm.
    const { error: submitError } = await elements.submit()
    if (submitError) {
      setErrorMessage(translatePaymentError(submitError, "card"))
      inFlightRef.current = false
      setSubmitting(false)
      return
    }

    const clientSecret = session?.data?.client_secret as string | undefined
    if (!clientSecret) {
      setErrorMessage(
        "Възникна проблем с инициализирането на плащането. Моля, презаредете страницата."
      )
      inFlightRef.current = false
      setSubmitting(false)
      return
    }

    // redirect: "if_required" — Stripe only redirects when the method
    // demands it (3DS challenge, bank-redirect APMs). Card + wallet
    // flows return the paymentIntent here and we call placeOrder
    // synchronously. When redirect IS required, Stripe navigates the
    // browser to return_url; the checkout page handles the return by
    // reading ?payment_intent=... on mount (see CheckoutClient
    // 3DS-return useEffect).
    await stripe
      .confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: typeof window !== "undefined" ? window.location.href : "",
          payment_method_data: {
            billing_details: {
              name: `${cart.billing_address?.first_name ?? ""} ${cart.billing_address?.last_name ?? ""}`.trim(),
              address: {
                city: cart.billing_address?.city ?? undefined,
                country: cart.billing_address?.country_code ?? undefined,
                line1: cart.billing_address?.address_1 ?? undefined,
                line2: cart.billing_address?.address_2 ?? undefined,
                postal_code: cart.billing_address?.postal_code ?? undefined,
                state: cart.billing_address?.province ?? undefined,
              },
              email: cart.email,
              phone: cart.billing_address?.phone ?? undefined,
            },
          },
        },
        redirect: "if_required",
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent
          // Stripe sometimes returns a 200-shaped error when the PI
          // already reached requires_capture / succeeded between
          // confirm() submission and response. Treat as success.
          if (
            pi &&
            (pi.status === "requires_capture" || pi.status === "succeeded")
          ) {
            onPaymentCompleted()
            return
          }
          setErrorMessage(translatePaymentError(error, "card"))
          inFlightRef.current = false
          setSubmitting(false)
          return
        }

        if (
          paymentIntent &&
          (paymentIntent.status === "requires_capture" ||
            paymentIntent.status === "succeeded")
        ) {
          return onPaymentCompleted()
        }

        // Unexpected status (processing, requires_action without
        // redirect, etc.) — release the lock so the user can retry.
        inFlightRef.current = false
        setSubmitting(false)
      })
  }

  return (
    <>
      <OrderButton
        onClick={handlePayment}
        // Disable on submit — `loading` is presentational only; without
        // this the user can double-click and fire a second confirmPayment
        // before the first one's state lands.
        disabled={disabled || notReady || submitting}
        loading={submitting}
        total={cart.total ?? undefined}
        currencyCode={cart.currency_code}
        testId={dataTestId}
        label={labels.placeOrder}
      />
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
    </>
  )
}

function ManualPaymentButton({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) {
  const labels = useCheckoutLabels()
  const orderConfirmedPath = useOrderConfirmedPath()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // See StripePaymentButton for why we need both submitting + ref.
  const inFlightRef = useRef(false)

  const onPaymentCompleted = async () => {
    await placeOrder(undefined, undefined, orderConfirmedPath)
      .catch((err: unknown) => {
        setErrorMessage(translatePaymentError(err, "cod"))
      })
      .finally(() => {
        inFlightRef.current = false
        setSubmitting(false)
      })
  }

  const handlePayment = () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setSubmitting(true)
    setErrorMessage(null)
    onPaymentCompleted()
  }

  return (
    <>
      <OrderButton
        onClick={handlePayment}
        // Disable on submit — `loading` is presentational only; double-
        // click without this fires a second cart.complete before
        // Medusa's idempotency takes effect, surfacing a confusing error.
        disabled={notReady || submitting}
        loading={submitting}
        total={cart.total ?? undefined}
        currencyCode={cart.currency_code}
        testId={dataTestId}
        label={labels.placeOrder}
      />
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}
