/**
 * Payment provider helpers — identifier sniffing for Medusa payment sessions.
 *
 * Extracted from mindpages-storefront src/lib/constants.tsx. Intentionally
 * ships NO icons — stores render their own icons via their own icon set.
 * The library stays free of `@medusajs/icons` or any Medusa UI kit imports
 * at this layer.
 */

/**
 * True if the provider id is a Stripe-backed card payment provider.
 * Covers native Stripe and the `medusa-payments` wrapper.
 */
export const isStripeLike = (providerId?: string): boolean => {
  return Boolean(
    providerId &&
      (providerId.startsWith("pp_stripe_") || providerId.startsWith("pp_medusa-"))
  )
}

/** True if the provider id is PayPal. */
export const isPaypal = (providerId?: string): boolean => {
  return Boolean(providerId?.startsWith("pp_paypal"))
}

/**
 * True if the provider id is Medusa's manual/system-default provider
 * (used for cash-on-delivery / offline payments).
 */
export const isManual = (providerId?: string): boolean => {
  return Boolean(providerId?.startsWith("pp_system_default"))
}

export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element | null }
> = {
  pp_stripe_stripe: { title: "Credit / debit card", icon: null },
  "pp_medusa-payments_default": { title: "Credit / debit card", icon: null },
  "pp_stripe-ideal_stripe": { title: "iDeal", icon: null },
  "pp_stripe-bancontact_stripe": { title: "Bancontact", icon: null },
  pp_paypal_paypal: { title: "PayPal", icon: null },
  pp_system_default: { title: "Cash on delivery", icon: null },
}
