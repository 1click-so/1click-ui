"use client"

import type { HttpTypes } from "@medusajs/types"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import { useState } from "react"

import { placeOrder } from "../data/cart"
import { DualPrice } from "../lib/dual-price"
import { isManual, isStripeLike } from "../lib/payment-constants"
import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"
import { ErrorMessage } from "./error-message"

/**
 * PaymentButton — top-level "place order" button. Routes to the correct
 * variant based on the cart's active payment session:
 *   - StripePaymentButton: confirms card payment via Stripe.js, then calls
 *     placeOrder()
 *   - ManualPaymentButton: calls placeOrder() directly (COD / offline)
 *   - Disabled fallback when no payment session is set
 *
 * Extracted from mindpages-storefront
 * src/modules/checkout/components/payment-button/index.tsx.
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
        "w-full h-14 bg-text-base text-surface text-base font-semibold rounded-xl",
        "flex items-center justify-center gap-2.5 transition-all",
        "hover:bg-text-base/90 active:scale-[0.99]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-text-base"
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
                  bgnClassName="text-surface/70 text-[11px] ml-1"
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

  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  if (isStripeLike(paymentSession?.provider_id)) {
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
      className="w-full h-14 bg-surface-muted text-text-muted text-base font-semibold rounded-xl cursor-not-allowed"
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

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const stripe = useStripe()
  const elements = useElements()
  const card = elements?.getElement("cardNumber")

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  const disabled = !stripe || !elements

  const handlePayment = async () => {
    setSubmitting(true)

    if (!stripe || !elements || !card || !cart) {
      setSubmitting(false)
      return
    }

    await stripe
      .confirmCardPayment(session?.data?.client_secret as string, {
        payment_method: {
          card,
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
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent
          if (pi && (pi.status === "requires_capture" || pi.status === "succeeded")) {
            onPaymentCompleted()
          }
          setErrorMessage(error.message || null)
          return
        }

        if (
          paymentIntent &&
          (paymentIntent.status === "requires_capture" || paymentIntent.status === "succeeded")
        ) {
          return onPaymentCompleted()
        }
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
