"use client"

import type { HttpTypes } from "@medusajs/types"
import type { Appearance, StripeElementsOptions } from "@stripe/stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import type { ReactNode } from "react"

import { isStripeLike } from "../lib/payment-constants"
import { StripeScopeProvider } from "./stripe-wrapper"

/**
 * PaymentWrapper — provides Stripe Elements scope context to descendants.
 *
 * IMPORTANT: this no longer wraps children in `<Elements>`. The actual
 * `<Elements key={clientSecret}>` mount lives at `<StripeElementsScope>`
 * inside payment-method-list.tsx, scoped to just the PaymentElement.
 *
 * Why: every cart-amount change rotates the Stripe payment session
 * (Medusa's createPaymentSessionsWorkflow always deletes + recreates
 * — see @medusajs/core-flows/dist/payment-collection/workflows/
 * create-payment-session.js:112-118), producing a new client_secret.
 * If `<Elements>` wraps the whole checkout tree, every rotation
 * unmounts + remounts every form field, every tracking ref, the entire
 * Stripe iframe — for one shipping-method change. Scoping `<Elements>`
 * to just the payment widget contains the remount cost to that widget.
 *
 * Stores still mount this at the top of their checkout page exactly
 * as before:
 *
 *   <PaymentWrapper cart={cart} appearance={...} fonts={...}>
 *     <CheckoutClient ... />
 *   </PaymentWrapper>
 *
 * Environment variables (read at module load time):
 *   - NEXT_PUBLIC_STRIPE_KEY  OR
 *     NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY
 *   - NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID (optional, for connect accounts)
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
  /**
   * Optional per-store Stripe Elements appearance — brand colors, font,
   * radius, etc. Forwarded to the StripeElementsScope provider so the
   * eventual `<Elements>` mount picks it up.
   */
  appearance?: Appearance
  /**
   * Optional custom fonts for the Stripe Elements iframe. Required
   * whenever `appearance.variables.fontFamily` references a custom
   * font — the iframe cannot see the parent document's loaded fonts.
   */
  fonts?: StripeElementsOptions["fonts"]
  children: ReactNode
}

export function PaymentWrapper({
  cart,
  appearance,
  fonts,
  children,
}: PaymentWrapperProps) {
  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  // "Ready" means: Stripe-backed pending session exists with a usable
  // client_secret AND the publishable key + Stripe.js promise are
  // available. Anything short of that and StripeElementsScope renders
  // its fallback (skeleton) instead of mounting `<Elements>`.
  const hasClientSecret = !!(
    paymentSession?.data as { client_secret?: string } | undefined
  )?.client_secret
  const ready =
    isStripeLike(paymentSession?.provider_id) &&
    !!paymentSession &&
    !!stripePromise &&
    hasClientSecret

  return (
    <StripeScopeProvider
      value={{
        ready,
        paymentSession,
        stripePromise,
        appearance,
        fonts,
      }}
    >
      {children}
    </StripeScopeProvider>
  )
}
