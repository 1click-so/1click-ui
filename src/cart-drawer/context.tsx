"use client"

import type { HttpTypes } from "@medusajs/types"
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useOptimistic,
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
 * Optimistic UI: the cart exposed via `useCartDrawer().cart` is wrapped
 * in React 19's `useOptimistic`. Callers (PDP add buttons, drawer
 * quantity steppers, drawer remove buttons) dispatch optimistic actions
 * BEFORE awaiting the corresponding server action. The drawer reflects
 * the change at React update speed (~16ms) instead of waiting for the
 * full backend round-trip + RSC re-fetch (~800-1500ms). On server-action
 * failure the optimistic state reverts automatically because the parent
 * `cart` prop never updated past the failed mutation. See
 * https://react.dev/reference/react/useOptimistic.
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

/**
 * Optimistic action shapes — what callers can dispatch to update the
 * cart UI ahead of the server confirmation.
 */
export type OptimisticCartAction =
  | {
      type: "add"
      /** Variant being added. We use this to merge with existing lines. */
      variant_id: string
      quantity: number
      /** Display fields the drawer needs to render the row immediately. */
      product_id?: string
      product_title?: string
      product_handle?: string
      thumbnail?: string | null
      variant_title?: string | null
      /** Per-unit price in minor units (e.g., cents). total = price × qty. */
      unit_price?: number
    }
  | {
      type: "remove"
      lineId: string
    }
  | {
      type: "update_quantity"
      lineId: string
      quantity: number
    }

type CartDrawerContextValue = {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  /** Cart snapshot AFTER any pending optimistic updates. */
  cart: HttpTypes.StoreCart | null
  /**
   * Dispatch an optimistic update. MUST be called inside a
   * `startTransition` (React requirement for useOptimistic setters
   * outside Action props). The CartDrawerProvider exposes a helper
   * `applyOptimistic` that wraps the dispatch in startTransition for
   * convenience; prefer that.
   */
  dispatchOptimistic: (action: OptimisticCartAction) => void
  /**
   * Convenience wrapper: dispatches the optimistic action AND awaits
   * the provided server-action callback inside a single transition.
   * Use from PDP add buttons, drawer quantity steppers, etc.
   */
  applyOptimistic: (
    action: OptimisticCartAction,
    serverAction: () => Promise<unknown>
  ) => void
  labels: CartDrawerLabels
  hrefs: CartDrawerHrefs
}

const CartDrawerContext = createContext<CartDrawerContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  cart: null,
  dispatchOptimistic: () => {},
  applyOptimistic: () => {},
  labels: defaultCartDrawerLabels,
  hrefs: defaultHrefs,
})

export function useCartDrawer(): CartDrawerContextValue {
  return useContext(CartDrawerContext)
}

/**
 * Reducer for the useOptimistic cart. Pure function. Returns the next
 * cart shape after applying the action. Falls back to a synthetic empty
 * cart when there's no current cart yet so optimistic adds work even on
 * first-add (the server backfills the real cart_id + line_id below).
 */
function reduceCart(
  current: HttpTypes.StoreCart | null,
  action: OptimisticCartAction
): HttpTypes.StoreCart | null {
  if (!current) {
    // No cart yet on the server — synthesize a minimal one so the drawer
    // can render the item immediately. The real server action will
    // create the cart and the next refresh replaces this synthetic one.
    if (action.type !== "add") return current
    return {
      id: "optimistic-cart",
      items: [makeOptimisticLine(action)],
    } as unknown as HttpTypes.StoreCart
  }

  switch (action.type) {
    case "add": {
      const items = current.items ?? []
      const existing = items.find((i) => i.variant_id === action.variant_id)
      if (existing) {
        return {
          ...current,
          items: items.map((i) =>
            i.variant_id === action.variant_id
              ? {
                  ...i,
                  quantity: i.quantity + action.quantity,
                  total:
                    (i.unit_price ?? 0) * (i.quantity + action.quantity),
                }
              : i
          ),
        }
      }
      return {
        ...current,
        items: [...items, makeOptimisticLine(action)],
      }
    }
    case "remove": {
      return {
        ...current,
        items: (current.items ?? []).filter((i) => i.id !== action.lineId),
      }
    }
    case "update_quantity": {
      return {
        ...current,
        items: (current.items ?? []).map((i) =>
          i.id === action.lineId
            ? {
                ...i,
                quantity: action.quantity,
                total: (i.unit_price ?? 0) * action.quantity,
              }
            : i
        ),
      }
    }
  }
}

/**
 * Build a synthetic line item from an "add" action. The real server
 * response will replace this with the actual line on next refresh.
 * Cast through `unknown` because StoreCartLineItem has many fields we
 * don't have at click time (created_at, raw_unit_price, etc.) — the
 * renderer is lenient about missing optional fields.
 */
function makeOptimisticLine(
  action: Extract<OptimisticCartAction, { type: "add" }>
): HttpTypes.StoreCartLineItem {
  const unitPrice = action.unit_price ?? 0
  return {
    id: `optimistic-${action.variant_id}`,
    variant_id: action.variant_id,
    product_id: action.product_id,
    product_title: action.product_title,
    product_handle: action.product_handle,
    thumbnail: action.thumbnail,
    variant_title: action.variant_title,
    quantity: action.quantity,
    unit_price: unitPrice,
    total: unitPrice * action.quantity,
    original_total: unitPrice * action.quantity,
  } as unknown as HttpTypes.StoreCartLineItem
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

  const [optimisticCart, dispatchOptimistic] = useOptimistic(
    cart,
    reduceCart
  )

  const totalItems =
    optimisticCart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0

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

  const applyOptimistic = useCallback(
    (action: OptimisticCartAction, serverAction: () => Promise<unknown>) => {
      // useOptimistic setters MUST be called inside a transition or an
      // Action prop, otherwise React errors during render. Wrapping
      // both the dispatch AND the awaited server action in a single
      // startTransition ensures the optimistic state stays "pending"
      // for the entire round-trip — and reverts cleanly on throw.
      startTransition(async () => {
        dispatchOptimistic(action)
        try {
          await serverAction()
        } catch {
          // Optimistic state auto-reverts because parent `cart` prop
          // hasn't updated. Caller is responsible for surfacing errors.
        }
      })
    },
    [dispatchOptimistic]
  )

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
      value={{
        isOpen,
        open,
        close,
        toggle,
        cart: optimisticCart,
        dispatchOptimistic,
        applyOptimistic,
        labels,
        hrefs,
      }}
    >
      {children}
    </CartDrawerContext.Provider>
  )
}
