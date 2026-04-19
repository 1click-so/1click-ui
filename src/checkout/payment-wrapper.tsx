"use client"

import type { HttpTypes } from "@medusajs/types"
import { loadStripe } from "@stripe/stripe-js"
import type { ReactNode } from "react"

import { isStripeLike } from "../lib/payment-constants"
import { StripeWrapper } from "./stripe-wrapper"

/**
 * PaymentWrapper — top-level wrapper for the checkout tree. Inspects the
 * cart's active payment session; if it's Stripe-backed, wraps children
 * in a Stripe `<Elements>` provider. Otherwise passes through.
 *
 * Stores mount this at the top of their checkout page:
 *
 *   <PaymentWrapper cart={cart}>
 *     <CheckoutClient ... />
 *   </PaymentWrapper>
 *
 * Environment variables (read at module load time):
 *   - NEXT_PUBLIC_STRIPE_KEY  OR
 *     NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY
 *   - NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID (optional, for connect accounts)
 *
 * Extracted from mindpages-storefront
 * src/modules/checkout/components/payment-wrapper/index.tsx.
 */

const stripeKey =
  process.env.NEXT_PUBLIC_STRIPE_KEY ||
  process.env.NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY

const medusaAccountId = process.env.NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID

const stripePromise = stripeKey
  ? loadStripe(
      stripeKey,
      medusaAccountId ? { stripeAccount: medusaAccountId } : undefined
    )
  : null

type PaymentWrapperProps = {
  cart: HttpTypes.StoreCart
  children: ReactNode
}

export function PaymentWrapper({ cart, children }: PaymentWrapperProps) {
  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  // Only wrap in StripeWrapper when the pending session is Stripe-backed
  // AND already has a client_secret. A Stripe session without a secret
  // means Medusa's initiatePaymentSession returned without a confirmed
  // intent (can happen on first render, before CheckoutClient has auto-
  // initiated the session). Rendering StripeWrapper without a secret
  // throws and blows up the whole checkout page — so bail to the
  // unwrapped tree until the secret is ready.
  const hasClientSecret = !!(paymentSession?.data as { client_secret?: string } | undefined)
    ?.client_secret

  if (
    isStripeLike(paymentSession?.provider_id) &&
    paymentSession &&
    stripePromise &&
    hasClientSecret
  ) {
    return (
      <StripeWrapper
        paymentSession={paymentSession}
        stripeKey={stripeKey}
        stripePromise={stripePromise}
      >
        {children}
      </StripeWrapper>
    )
  }

  return <div>{children}</div>
}
