"use client"

import type {
  AddToCartData,
  InitiateCheckoutData,
  PurchaseData,
  ViewContentData,
} from "./types"

/**
 * Typed wrappers around the global `fbq()` from Meta Pixel.
 *
 * All helpers no-op when `window.fbq` is undefined (pixel not loaded —
 * e.g., admin disabled it, or SSR). Storefronts can call these freely
 * without guards.
 *
 * `trackPurchase` is the ONLY helper that takes an `eventID`. It MUST
 * equal the server-side CAPI event_id (`purchase_${order.display_id}`)
 * so Meta deduplicates the Browser + Server events into one conversion.
 * Without matching IDs, every purchase is double-counted.
 */

type FbqFn = {
  (command: "init", pixelId: string): void
  (
    command: "track",
    eventName: string,
    data?: Record<string, unknown>,
    options?: { eventID?: string }
  ): void
  (
    command: "trackCustom",
    eventName: string,
    data?: Record<string, unknown>,
    options?: { eventID?: string }
  ): void
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  loaded: boolean
  version: string
}

declare global {
  interface Window {
    fbq?: FbqFn
  }
}

function safeFbq(): FbqFn | null {
  if (typeof window === "undefined") return null
  return window.fbq ?? null
}

export function trackViewContent(data: ViewContentData): void {
  const fbq = safeFbq()
  if (!fbq) return
  fbq("track", "ViewContent", data)
}

export function trackAddToCart(data: AddToCartData): void {
  const fbq = safeFbq()
  if (!fbq) return
  fbq("track", "AddToCart", data)
}

export function trackInitiateCheckout(data: InitiateCheckoutData): void {
  const fbq = safeFbq()
  if (!fbq) return
  fbq("track", "InitiateCheckout", data)
}

/**
 * Purchase event — MUST be called with the same eventID as the server's
 * CAPI event for Meta to deduplicate. Backend uses
 * `event_id = "purchase_${order.display_id}"`. Mirror this on the client:
 *
 *   trackPurchase(data, `purchase_${order.display_id}`)
 */
export function trackPurchase(data: PurchaseData, eventID: string): void {
  const fbq = safeFbq()
  if (!fbq) return
  fbq("track", "Purchase", data, { eventID })
}
