"use client"

import { Elements, useElements } from "@stripe/react-stripe-js"
import type {
  Appearance,
  Stripe,
  StripeElementsOptions,
} from "@stripe/stripe-js"
import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react"

/**
 * Stripe Elements scope — context + scoped wrapper, **deferred-intent** mode.
 *
 * As of the deferred-checkout architecture (see
 * docs/checkout-architecture.md in the consuming store), `<Elements>` is
 * mounted with `mode: 'payment'`, `amount`, `currency` — NO PaymentIntent
 * exists on the backend yet. Stripe creates the PI at Buy click via our
 * `prepareCheckout` server action; the storefront calls
 * `stripe.confirmPayment({ elements, clientSecret })` after the
 * PaymentIntent is returned.
 *
 * Why deferred-intent (verified against Stripe docs).
 *
 *   The previous eager-session model created a PaymentIntent on payment-
 *   tab switch. Every cart-amount change rotated the PI (Medusa's
 *   createPaymentSessionsWorkflow always deletes + recreates — verified
 *   at @medusajs/core-flows/dist/payment-collection/workflows/create-
 *   payment-session.js:112-118), forcing `<Elements>` to remount on a
 *   new client_secret and blanking the user's typed-in card form.
 *
 *   Stripe's deferred-intent flow
 *   (https://docs.stripe.com/payments/accept-a-payment-deferred) lets
 *   `<Elements>` mount with just `mode/amount/currency`. When the
 *   amount changes (shipping switch, COD-fee toggle), call
 *   `elements.update({ amount })` and the iframe updates in place — no
 *   remount, no card-form blank-out.
 *
 * Boolean `StripeContext` is preserved for back-compat (consumers like
 * payment-method-list.tsx read it as `stripeReady`). It now derives
 * from the scope's `ready` flag (Stripe.js promise + valid key).
 */

// Boolean context kept for the existing `useContext(StripeContext)`
// usage in payment-method-list.tsx and any storefront-side consumers.
export const StripeContext = createContext(false)

type StripeScopeValue = {
  /** True when Stripe.js promise + publishable key are available. */
  ready: boolean
  stripePromise: Promise<Stripe | null> | null
  /** Optimistic total in the smallest currency unit (cents/stotinki). */
  amount: number
  currency: string
  appearance?: Appearance
  fonts?: StripeElementsOptions["fonts"]
}

const StripeScopeContext = createContext<StripeScopeValue>({
  ready: false,
  stripePromise: null,
  amount: 0,
  currency: "eur",
})

export function StripeScopeProvider({
  value,
  children,
}: {
  value: StripeScopeValue
  children: ReactNode
}) {
  return (
    <StripeContext.Provider value={value.ready}>
      <StripeScopeContext.Provider value={value}>
        {children}
      </StripeScopeContext.Provider>
    </StripeContext.Provider>
  )
}

export function useStripeScope(): StripeScopeValue {
  return useContext(StripeScopeContext)
}

/**
 * StripeElementsScope — wraps children in Stripe's `<Elements>` provider
 * in deferred-intent mode. Children mount inside `<Elements>` so
 * `useStripe()` / `useElements()` work for the payment widget AND the
 * Buy button.
 *
 * Behaviour when Stripe isn't ready (no stripePromise / no key):
 *   - default            → renders `fallback` (or null)
 *   - `passthrough` mode → renders children directly, without `<Elements>`
 *
 * Use `passthrough` when wrapping a section that contains BOTH Stripe-
 * dependent UI (PaymentElement) AND non-Stripe UI (a manual / COD
 * branch). Without it, COD-only carts (no Stripe key) would render
 * nothing inside the wrapper.
 *
 * Amount syncing: the inner `<AmountSync>` calls `elements.update({ amount })`
 * whenever the optimistic total changes. No remount.
 */
export function StripeElementsScope({
  fallback = null,
  passthrough = false,
  children,
}: {
  fallback?: ReactNode
  passthrough?: boolean
  children: ReactNode
}) {
  const { ready, stripePromise, amount, currency, appearance, fonts } =
    useStripeScope()

  if (!ready || !stripePromise) {
    return <>{passthrough ? children : fallback}</>
  }

  // `loader: "always"` forces Elements to fetch the payment-method config
  // up front so a config error (bad key, network) surfaces via
  // onLoadError instead of silently failing on first interaction.
  const options: StripeElementsOptions = {
    mode: "payment",
    amount,
    currency: currency.toLowerCase(),
    appearance,
    fonts,
    loader: "always",
  }

  return (
    <Elements options={options} stripe={stripePromise}>
      <AmountSync amount={amount} currency={currency} />
      {children}
    </Elements>
  )
}

/**
 * Empty component that calls `elements.update({ amount, currency })`
 * whenever the props change. Stripe's `elements.update` is the
 * documented way to push amount/currency changes into a deferred-intent
 * `<Elements>` instance without remounting it.
 *
 * Reference: https://docs.stripe.com/payments/accept-a-payment-deferred
 */
function AmountSync({
  amount,
  currency,
}: {
  amount: number
  currency: string
}) {
  const elements = useElements()
  useEffect(() => {
    if (!elements) return
    elements.update({ amount, currency: currency.toLowerCase() })
  }, [elements, amount, currency])
  return null
}
