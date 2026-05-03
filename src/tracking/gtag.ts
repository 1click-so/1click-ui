"use client"

/**
 * Typed wrappers around the global `gtag()` from GA4 (gtag.js).
 *
 * Follows Google's GA4 Enhanced Ecommerce event spec:
 * https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
 *
 * All helpers no-op when `window.gtag` is undefined (GA4 not loaded —
 * e.g., admin disabled it, or SSR). Storefronts can call these freely
 * without guards.
 *
 * Purchase dedup: GA4 deduplicates Purchase events by `transaction_id`
 * automatically — no need to coordinate event IDs across client + server.
 * Pass the same `transaction_id = String(order.display_id)` on both
 * sides and GA4 collapses them into a single conversion.
 */

type GA4Item = {
  item_id: string
  item_name: string
  quantity: number
  price: number
  currency?: string
  index?: number
}

type GA4ViewItemData = {
  currency: string
  value: number
  items: GA4Item[]
}

type GA4AddToCartData = {
  currency: string
  value: number
  items: GA4Item[]
}

type GA4BeginCheckoutData = {
  currency: string
  value: number
  items: GA4Item[]
  coupon?: string
}

type GA4PurchaseData = {
  transaction_id: string
  currency: string
  value: number
  items: GA4Item[]
  tax?: number
  shipping?: number
  coupon?: string
}

type GtagFn = (
  command: "event" | "config" | "set" | "get" | "js",
  ...args: unknown[]
) => void

declare global {
  interface Window {
    gtag?: GtagFn
    dataLayer?: unknown[]
  }
}

function safeGtag(): GtagFn | null {
  if (typeof window === "undefined") return null
  return window.gtag ?? null
}

export function trackGAViewItem(data: GA4ViewItemData): void {
  const gtag = safeGtag()
  if (!gtag) return
  gtag("event", "view_item", data)
}

export function trackGAAddToCart(data: GA4AddToCartData): void {
  const gtag = safeGtag()
  if (!gtag) return
  gtag("event", "add_to_cart", data)
}

export function trackGABeginCheckout(data: GA4BeginCheckoutData): void {
  const gtag = safeGtag()
  if (!gtag) return
  gtag("event", "begin_checkout", data)
}

/**
 * Purchase event — GA4 deduplicates by `transaction_id`. Pass the SAME
 * `String(order.display_id)` here AND in the backend Measurement Protocol
 * payload so the two events collapse into one conversion.
 */
export function trackGAPurchase(data: GA4PurchaseData): void {
  const gtag = safeGtag()
  if (!gtag) return
  gtag("event", "purchase", data)
}

export type {
  GA4Item,
  GA4ViewItemData,
  GA4AddToCartData,
  GA4BeginCheckoutData,
  GA4PurchaseData,
}
