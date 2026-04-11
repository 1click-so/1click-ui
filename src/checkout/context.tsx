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
}

const CheckoutContext = createContext<CheckoutContextValue>({
  labels: defaultCheckoutLabels,
})

export function useCheckoutLabels(): CheckoutLabels {
  return useContext(CheckoutContext).labels
}

export function CheckoutProvider({
  labels: labelOverrides,
  children,
}: {
  labels?: Partial<CheckoutLabels>
  children: ReactNode
}) {
  const labels: CheckoutLabels = {
    ...defaultCheckoutLabels,
    ...labelOverrides,
  }
  return (
    <CheckoutContext.Provider value={{ labels }}>
      {children}
    </CheckoutContext.Provider>
  )
}
