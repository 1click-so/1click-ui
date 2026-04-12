"use client"

import type { HttpTypes } from "@medusajs/types"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { defaultCartDrawerLabels, type CartDrawerLabels } from "./labels"

/**
 * Cart drawer context — open state + cart snapshot + labels + link hrefs.
 *
 * Stores wrap their root layout with `<CartDrawerProvider cart={cart}>`
 * (the cart is fetched server-side and passed down as a prop). The
 * provider manages open/close state, auto-opens when item count rises,
 * locks body scroll while open, and closes on escape.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/context.tsx.
 * Extended with `labels` and `hrefs` fields so stores can fully localize
 * and control link destinations without editing library code.
 */

type CartDrawerHrefs = {
  /** Href for the checkout button in the sticky footer */
  checkout: string
  /** Href for the "browse products" CTA on the empty state */
  browse: string
  /** Prefix for product links — full href is `${productPrefix}/${handle}` */
  productPrefix: string
}

const defaultHrefs: CartDrawerHrefs = {
  checkout: "/checkout",
  browse: "/store",
  productPrefix: "/products",
}

type CartDrawerContextValue = {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  cart: HttpTypes.StoreCart | null
  labels: CartDrawerLabels
  hrefs: CartDrawerHrefs
}

const CartDrawerContext = createContext<CartDrawerContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  cart: null,
  labels: defaultCartDrawerLabels,
  hrefs: defaultHrefs,
})

export function useCartDrawer(): CartDrawerContextValue {
  return useContext(CartDrawerContext)
}

export function CartDrawerProvider({
  cart,
  labels: labelOverrides,
  hrefs: hrefOverrides,
  children,
}: {
  cart: HttpTypes.StoreCart | null
  labels?: Partial<CartDrawerLabels>
  hrefs?: Partial<CartDrawerHrefs>
  children: ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const prevItemCount = useRef(0)

  const totalItems =
    cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0

  // Auto-open when items are added (count increases AFTER initial load)
  useEffect(() => {
    if (totalItems > prevItemCount.current && prevItemCount.current > 0) {
      setIsOpen(true)
    }
    prevItemCount.current = totalItems
  }, [totalItems])

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  // Escape closes
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false)
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  const labels: CartDrawerLabels = {
    ...defaultCartDrawerLabels,
    ...labelOverrides,
  }
  const hrefs: CartDrawerHrefs = {
    ...defaultHrefs,
    ...hrefOverrides,
  }

  return (
    <CartDrawerContext.Provider
      value={{ isOpen, open, close, toggle, cart, labels, hrefs }}
    >
      {children}
    </CartDrawerContext.Provider>
  )
}
