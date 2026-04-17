"use client"

import type { HttpTypes } from "@medusajs/types"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import { useContext, useState } from "react"

import { placeOrder } from "../data/cart"
import { DualPrice } from "../lib/dual-price"
import { isManual, isStripeLike } from "../lib/payment-constants"
import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"
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

export function PaymentButton({ cart, "data-testid": dataTestId }: PaymentButtonProps) {
  const labels = useCheckoutLabels()
  const stripeReady = useContext(StripeContext)

  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  if (isStripeLike(paymentSession?.provider_id) && stripeReady) {
    return (
      <StripePaymentButton
        notReady={notReady}
        cart={cart}
        data-testid={dataTestId}
      />
    )
  }

  if (isManual(paymentSession?.provider_id)) {
    return (
      <ManualPaymentButton
        notReady={notReady}
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
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const stripe = useStripe()
  const elements = useElements()

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  const disabled = !stripe || !elements

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = async () => {
    if (!stripe || !elements || !cart) {
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    // Payment Element requires an explicit submit() before confirm.
    const { error: submitError } = await elements.submit()
    if (submitError) {
      setErrorMessage(submitError.message ?? null)
      setSubmitting(false)
      return
    }

    const clientSecret = session?.data?.client_secret as string | undefined
    if (!clientSecret) {
      setErrorMessage("Missing Stripe client secret.")
      setSubmitting(false)
      return
    }

    // redirect: "if_required" — Stripe only redirects when the method
    // demands it (3DS challenge, bank-redirect APMs). Card + wallet
    // flows return the paymentIntent here and we call placeOrder
    // synchronously. When redirect IS required, Stripe navigates the
    // browser to return_url; the checkout page handles the return by
    // reading ?payment_intent=... on mount (future work).
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
          if (
            pi &&
            (pi.status === "requires_capture" || pi.status === "succeeded")
          ) {
            onPaymentCompleted()
            return
          }
          setErrorMessage(error.message || null)
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

        setSubmitting(false)
      })
  }

  return (
    <>
      <OrderButton
        onClick={handlePayment}
        disabled={disabled || notReady}
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
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = () => {
    setSubmitting(true)
    onPaymentCompleted()
  }

  return (
    <>
      <OrderButton
        onClick={handlePayment}
        disabled={notReady}
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
