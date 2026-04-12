"use client"

import { createContext, useContext, type ReactNode } from "react"
import { defaultOrderLabels, type OrderLabels } from "./labels"

const OrderLabelsContext = createContext<OrderLabels>(defaultOrderLabels)

export function OrderLabelsProvider({
  labels,
  children,
}: {
  labels?: Partial<OrderLabels>
  children: ReactNode
}) {
  const merged = labels
    ? { ...defaultOrderLabels, ...labels }
    : defaultOrderLabels

  return (
    <OrderLabelsContext.Provider value={merged}>
      {children}
    </OrderLabelsContext.Provider>
  )
}

export function useOrderLabels() {
  return useContext(OrderLabelsContext)
}
