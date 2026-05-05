"use client"

import type { HttpTypes } from "@medusajs/types"
import type { Appearance, StripeElementsOptions } from "@stripe/stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import type { ReactNode } from "react"

import { StripeScopeProvider } from "./stripe-wrapper"

/**
 * PaymentWrapper — provides Stripe Elements scope context to descendants.
 *
 * As of the deferred-checkout architecture, this wrapper supplies an
 * optimistic `amount` + `currency` (computed by the orchestration hook)
 * to `<Elements>` so the iframe can mount and stay mounted across
 * shipping/payment toggles. `elements.update({ amount })` keeps the
 * displayed total in sync without remounting — see stripe-wrapper.tsx
 * for the deferred-intent rationale.
 *
 * Stores mount this at the top of their checkout page exactly as before:
 *
 *   <PaymentWrapper cart={cart} amount={...} appearance={...} fonts={...}>
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
   * Optimistic total in the smallest currency unit (cents/stotinki).
   * Computed by `useCheckoutOrchestration` from cart.subtotal + tax +
   * optimistic shipping + optimistic COD fee. Changes to this prop
   * propagate via `elements.update({ amount })` without remounting.
   */
  amount: number
  /**
   * Optional per-store Stripe Elements appearance — brand colors, font,
   * radius, etc. Forwarded to the StripeElementsScope so the
   * `<Elements>` mount picks it up.
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
  amount,
  appearance,
  fonts,
  children,
}: PaymentWrapperProps) {
  // "Ready" simply means: Stripe.js loadable. We no longer wait for a
  // backend payment_session — deferred-intent mode mounts straight away.
  const ready = !!stripePromise

  return (
    <StripeScopeProvider
      value={{
        ready,
        stripePromise,
        amount,
        currency: cart.currency_code || "eur",
        appearance,
        fonts,
      }}
    >
      {children}
    </StripeScopeProvider>
  )
}
