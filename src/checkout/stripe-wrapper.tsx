"use client"

import { Elements } from "@stripe/react-stripe-js"
import type { Stripe, StripeElementsOptions } from "@stripe/stripe-js"
import type { HttpTypes } from "@medusajs/types"
import { createContext, type ReactNode } from "react"

/**
 * StripeWrapper — wraps children in a Stripe `<Elements>` provider seeded
 * with the payment session's client secret. Also exposes `StripeContext`
 * so downstream components can know whether Stripe is ready without
 * importing the Elements hook directly.
 *
 * Extracted from mindpages-storefront
 * src/modules/checkout/components/payment-wrapper/stripe-wrapper.tsx.
 */

export const StripeContext = createContext(false)

type StripeWrapperProps = {
  paymentSession: HttpTypes.StorePaymentSession
  stripeKey?: string
  stripePromise: Promise<Stripe | null> | null
  children: ReactNode
}

export function StripeWrapper({
  paymentSession,
  stripeKey,
  stripePromise,
  children,
}: StripeWrapperProps) {
  const options: StripeElementsOptions = {
    clientSecret: paymentSession.data?.client_secret as string | undefined,
  }

  if (!stripeKey) {
    throw new Error(
      "Stripe key is missing. Set NEXT_PUBLIC_STRIPE_KEY or NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY environment variable."
    )
  }

  if (!stripePromise) {
    throw new Error(
      "Stripe promise is missing. Make sure you have provided a valid Stripe key."
    )
  }

  if (!paymentSession?.data?.client_secret) {
    throw new Error(
      "Stripe client secret is missing. Cannot initialize Stripe."
    )
  }

  return (
    <StripeContext.Provider value={true}>
      <Elements options={options} stripe={stripePromise}>
        {children}
      </Elements>
    </StripeContext.Provider>
  )
}
