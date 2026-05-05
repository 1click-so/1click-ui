"use client"

/**
 * Typed wrappers around the global `window.rybbit.event()` from the
 * Rybbit tracker script (`<Rybbit siteId={...} />`).
 *
 * Rybbit only supports STRING and NUMBER property values (no arrays,
 * no objects, no booleans) and caps the property payload at 2KB
 * (https://rybbit.com/docs/track-events). The helpers below stick to
 * that contract — multi-item events flatten line ids into a
 * comma-separated string, which is enough for aggregation in Rybbit's
 * Custom Events view. Pixel/GA4 retain the rich item-level breakdown.
 *
 * All helpers no-op when `window.rybbit` is undefined (script not yet
 * loaded, admin disabled, or SSR). Storefronts can call these freely
 * alongside `trackGA*` and `track*` (Pixel) without guards.
 *
 * Event names match GA4 / industry vocabulary so the same dashboard
 * names work across analytics tools:
 *   view_item · add_to_cart · begin_checkout · purchase
 */

type RybbitEventProps = Record<string, string | number>

type RybbitFn = {
  event: (eventName: string, properties?: RybbitEventProps) => void
  pageview?: () => void
  identify?: (userId: string, traits?: RybbitEventProps) => void
}

declare global {
  interface Window {
    rybbit?: RybbitFn
  }
}

function safeRybbit(): RybbitFn | null {
  if (typeof window === "undefined") return null
  return window.rybbit ?? null
}

/**
 * Truncate a comma-joined list of ids so the resulting properties
 * payload stays under Rybbit's 2KB limit. Other props are short, so
 * a 1500-char cap on the joined string leaves comfortable headroom.
 */
function joinIds(ids: string[]): string {
  const joined = ids.join(",")
  return joined.length <= 1500 ? joined : joined.slice(0, 1500)
}

export type RybbitViewItemData = {
  item_id: string
  item_name: string
  currency: string
  value: number
}

export type RybbitAddToCartData = {
  item_id: string
  item_name: string
  quantity: number
  currency: string
  value: number
}

export type RybbitBeginCheckoutData = {
  item_ids: string[]
  num_items: number
  currency: string
  value: number
}

export type RybbitPurchaseData = {
  transaction_id: string
  item_ids: string[]
  num_items: number
  currency: string
  value: number
}

export function trackRybbitViewItem(data: RybbitViewItemData): void {
  const r = safeRybbit()
  if (!r) return
  r.event("view_item", {
    item_id: data.item_id,
    item_name: data.item_name,
    currency: data.currency,
    value: data.value,
  })
}

export function trackRybbitAddToCart(data: RybbitAddToCartData): void {
  const r = safeRybbit()
  if (!r) return
  r.event("add_to_cart", {
    item_id: data.item_id,
    item_name: data.item_name,
    quantity: data.quantity,
    currency: data.currency,
    value: data.value,
  })
}

export function trackRybbitBeginCheckout(
  data: RybbitBeginCheckoutData
): void {
  const r = safeRybbit()
  if (!r) return
  r.event("begin_checkout", {
    item_ids: joinIds(data.item_ids),
    num_items: data.num_items,
    currency: data.currency,
    value: data.value,
  })
}

/**
 * Purchase event — fired client-side on the order-confirmed page.
 *
 * Rybbit doesn't dedupe events the way Meta (eventID) or GA4
 * (transaction_id) do, so the storefront should fire this exactly
 * once per order. The caller (`track-purchase.tsx`) already gates
 * with sessionStorage + a useRef, so multiple mounts of the same
 * order page won't double-count.
 */
export function trackRybbitPurchase(data: RybbitPurchaseData): void {
  const r = safeRybbit()
  if (!r) return
  r.event("purchase", {
    transaction_id: data.transaction_id,
    item_ids: joinIds(data.item_ids),
    num_items: data.num_items,
    currency: data.currency,
    value: data.value,
  })
}
