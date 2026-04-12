"use client"

import { createContext, useContext, type ReactNode } from "react"
import { defaultProductLabels, type ProductLabels } from "./labels"

const ProductLabelsContext = createContext<ProductLabels>(defaultProductLabels)

export function ProductLabelsProvider({
  labels,
  children,
}: {
  labels?: Partial<ProductLabels>
  children: ReactNode
}) {
  const merged = labels
    ? { ...defaultProductLabels, ...labels }
    : defaultProductLabels

  return (
    <ProductLabelsContext.Provider value={merged}>
      {children}
    </ProductLabelsContext.Provider>
  )
}

export function useProductLabels() {
  return useContext(ProductLabelsContext)
}
