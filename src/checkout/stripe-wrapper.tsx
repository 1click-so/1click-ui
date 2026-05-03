"use client"

import { Elements } from "@stripe/react-stripe-js"
import type {
  Appearance,
  Stripe,
  StripeElementsOptions,
} from "@stripe/stripe-js"
import type { HttpTypes } from "@medusajs/types"
import { createContext, type ReactNode } from "react"

/**
 * StripeWrapper — wraps children in a Stripe `<Elements>` provider seeded
 * with the payment session's client secret. Also exposes `StripeContext`
 * so downstream components can know whether Stripe is ready without
 * importing the Elements hook directly.
 *
 * Server-side reconciliation runs in checkout/page.tsx via
 * `refreshPaymentIfTerminal` and is the primary defense against stale
 * client_secrets. PaymentElement's `onLoadError` handler in
 * `payment-method-list.tsx` is the client-side fallback when a PI goes
 * terminal after the page loaded.
 *
 * Extracted from mindpages-storefront
 * src/modules/checkout/components/payment-wrapper/stripe-wrapper.tsx.
 */

export const StripeContext = createContext(false)

type StripeWrapperProps = {
  paymentSession: HttpTypes.StorePaymentSession
  stripeKey?: string
  stripePromise: Promise<Stripe | null> | null
  /**
   * Optional per-store theming for every Stripe Element rendered under
   * this wrapper (PaymentElement, etc.). Pass Stripe's Appearance
   * object — theme, variables, rules. See
   * https://stripe.com/docs/elements/appearance-api
   */
  appearance?: Appearance
  /**
   * Optional custom font sources loaded into the Stripe Elements iframe.
   * Elements runs in an isolated iframe and cannot see the parent's
   * loaded fonts, so custom fonts referenced in `appearance.fontFamily`
   * must also be declared here via `{ cssSrc: "..." }` or
   * `{ family, src, weight, style }`. See
   * https://stripe.com/docs/js/appendix/style
   */
  fonts?: StripeElementsOptions["fonts"]
  children: ReactNode
}

export function StripeWrapper({
  paymentSession,
  stripeKey,
  stripePromise,
  appearance,
  fonts,
  children,
}: StripeWrapperProps) {
  // `loader: "always"` forces Elements to fetch the payment method config
  // up front, surfacing a config error (terminal-state PI, missing PMs)
  // immediately instead of silently failing on first interaction.
  const options: StripeElementsOptions = {
    clientSecret: paymentSession.data?.client_secret as string | undefined,
    appearance,
    fonts,
    loader: "always",
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
