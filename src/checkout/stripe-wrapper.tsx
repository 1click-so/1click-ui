"use client"

import { Elements } from "@stripe/react-stripe-js"
import type {
  Appearance,
  Stripe,
  StripeElementsOptions,
} from "@stripe/stripe-js"
import type { HttpTypes } from "@medusajs/types"
import { createContext, useContext, type ReactNode } from "react"

/**
 * Stripe Elements scope — context + scoped wrapper.
 *
 * Why this is now SCOPED instead of wrapping the whole checkout:
 *
 * Stripe's React SDK explicitly states that `<Elements>` props are
 * immutable: "Because props are immutable, you can't change `options`
 * after setting it." (https://docs.stripe.com/stripe-js/react). So
 * when a payment session rotates and a new client_secret arrives, the
 * only way to refresh `<Elements>` is to remount it via a key change.
 *
 * Earlier versions wrapped `<Elements>` around the entire checkout
 * tree. Result: every cart-amount change rotated the Stripe payment
 * session in Medusa (createPaymentSessionsWorkflow ALWAYS deletes +
 * recreates — verified at @medusajs/core-flows/dist/payment-collection/
 * workflows/create-payment-session.js:112-118), which produced a new
 * client_secret, which forced a full unmount + remount of the entire
 * checkout subtree. Tracking refs reset, address form state lost,
 * tracking events refired, Stripe iframe re-loaded from CDN — all on a
 * single shipping-method change.
 *
 * The fix: PaymentWrapper now provides this scope via context, but does
 * NOT mount `<Elements>`. The actual `<Elements key={clientSecret}>`
 * mount lives at `<StripeElementsScope>` which wraps just the
 * PaymentElement inside payment-method-list.tsx. Rotation now only
 * remounts the payment widget; address form, shipping selector,
 * orchestration tree — all stay mounted.
 *
 * Backwards-compat:
 *   - `StripeContext` (boolean) is still exported and consumers (e.g.
 *     payment-method-list's stripeReady check) read it as before. It's
 *     now derived from the scope context's `ready` flag.
 *   - `StripeWrapper` (the old whole-tree wrapper) is removed. Stores
 *     consume `<PaymentWrapper>` which provides this scope. Direct
 *     consumers of `StripeWrapper` (none in this monorepo at v1.15.0)
 *     would need to migrate.
 */

// Boolean context kept for the existing `useContext(StripeContext)`
// usage in payment-method-list.tsx and any storefront-side consumers.
export const StripeContext = createContext(false)

type StripeScopeValue = {
  /** True when a Stripe-backed pending session with a client_secret exists. */
  ready: boolean
  paymentSession?: HttpTypes.StorePaymentSession
  stripePromise: Promise<Stripe | null> | null
  appearance?: Appearance
  fonts?: StripeElementsOptions["fonts"]
}

const StripeScopeContext = createContext<StripeScopeValue>({
  ready: false,
  stripePromise: null,
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
 * keyed by the current client_secret. Renders `fallback` (or null) when
 * Stripe isn't ready yet (no session, no key, non-Stripe provider).
 *
 * Place this around the smallest possible subtree that needs Stripe
 * Elements (typically just the `<PaymentElement>`). Anything outside
 * this scope is NOT torn down when the payment session rotates.
 */
export function StripeElementsScope({
  fallback = null,
  children,
}: {
  fallback?: ReactNode
  children: ReactNode
}) {
  const { ready, paymentSession, stripePromise, appearance, fonts } =
    useStripeScope()

  const clientSecret = (
    paymentSession?.data as { client_secret?: string } | undefined
  )?.client_secret

  if (!ready || !stripePromise || !clientSecret) {
    return <>{fallback}</>
  }

  // `loader: "always"` forces Elements to fetch the payment method
  // config up front, so a config error (terminal-state PI, missing
  // payment methods) surfaces immediately via onLoadError instead of
  // silently failing on first user interaction.
  const options: StripeElementsOptions = {
    clientSecret,
    appearance,
    fonts,
    loader: "always",
  }

  // `key={clientSecret}` forces a remount when the session rotates.
  // Stripe's React SDK requires this — options are immutable. Now that
  // this wraps only the payment widget, the remount cost is contained.
  return (
    <Elements key={clientSecret} options={options} stripe={stripePromise}>
      {children}
    </Elements>
  )
}
