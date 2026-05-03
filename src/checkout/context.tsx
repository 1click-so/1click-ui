"use client"

import { createContext, useContext, type ReactNode } from "react"

import { defaultCheckoutLabels, type CheckoutLabels } from "./labels"

/**
 * CheckoutContext — supplies labels to every checkout primitive without
 * prop drilling. Stores wrap the checkout page or their own composition
 * with `<CheckoutProvider labels={...}>` and every primitive inside reads
 * from context.
 *
 * Unlike the cart drawer, the checkout context is labels-only. Form
 * state, cart data, shipping methods, and payment sessions are passed
 * through as props to `CheckoutClient` because they are request-specific.
 */

type CheckoutContextValue = {
  labels: CheckoutLabels
  /**
   * Template for the post-success redirect URL after placeOrder.
   * Substitutions:
   *   {id}      → order.id
   *   {country} → lowercase ISO country code from shipping_address
   *
   * Default: "/{country}/order/{id}/confirmed" — for stores whose
   * URL structure includes a country segment (e.g. MindPages).
   *
   * Stores with flattened single-country URLs (e.g. Alenika) should
   * pass "/order/{id}/confirmed" via CheckoutProvider.
   */
  orderConfirmedPath: string
}

const DEFAULT_CONFIRMED_PATH = "/{country}/order/{id}/confirmed"

const CheckoutContext = createContext<CheckoutContextValue>({
  labels: defaultCheckoutLabels,
  orderConfirmedPath: DEFAULT_CONFIRMED_PATH,
})

export function useCheckoutLabels(): CheckoutLabels {
  return useContext(CheckoutContext).labels
}

export function useOrderConfirmedPath(): string {
  return useContext(CheckoutContext).orderConfirmedPath
}

export function CheckoutProvider({
  labels: labelOverrides,
  orderConfirmedPath,
  children,
}: {
  labels?: Partial<CheckoutLabels>
  orderConfirmedPath?: string
  children: ReactNode
}) {
  const labels: CheckoutLabels = {
    ...defaultCheckoutLabels,
    ...labelOverrides,
  }
  return (
    <CheckoutContext.Provider
      value={{
        labels,
        orderConfirmedPath: orderConfirmedPath ?? DEFAULT_CONFIRMED_PATH,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  )
}
