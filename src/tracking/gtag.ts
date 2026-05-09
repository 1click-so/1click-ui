"use client"

import { sha256Hex, normaliseEmailForHash, normalisePhoneForHash } from "./attribution"

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
 *
 * Enhanced Conversions for Web (setEnhancedConversions below) sends
 * hashed user-provided data through the same gtag.js so Google Ads —
 * via the GA4 ↔ Ads link — can recover conversions that cookies miss
 * (iOS / Safari ITP / ad-blockers). Spec:
 * https://support.google.com/google-ads/answer/13258081
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

/**
 * Enhanced Conversions for Web — sends hashed user-provided PII via
 * the gtag user_data channel. Google Ads (linked via GA4) consumes
 * these signals to recover conversions that browser cookies miss
 * (Safari ITP, iOS, ad-blockers).
 *
 * Hashing strategy mirrors the Meta side (attribution.ts):
 *   - email / phone / first_name / last_name → SHA-256 hex, lowercase
 *     normalised, phone E.164-style digits-only with country code
 *   - city / region / postal_code / country / street → raw plain text
 *     (Google's spec only documents sha256 variants for name fields
 *     within the address block; geo fields are accepted as plain)
 *
 * Same input on both sides produces same digest → both vendors' match
 * engines see identical hashes for the same user. Storefront callers
 * pass RAW values; this function does the normalize+hash inline.
 *
 * Idempotent — safe to call repeatedly as new fields become known
 * (gtag.set merges user_data per Google's spec).
 *
 * No-ops when window.gtag is undefined (GA4 not loaded, SSR, etc).
 *
 * Spec: https://support.google.com/google-ads/answer/13258081
 */
export type EnhancedConversionsInput = {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  street?: string
  city?: string
  /** GA4 spec uses "region" for state / province / oblast. */
  region?: string
  postalCode?: string
  /** 2-letter ISO country code (lowercase or upper — Google normalises). */
  country?: string
}

export async function setEnhancedConversions(
  input: EnhancedConversionsInput
): Promise<void> {
  const gtag = safeGtag()
  if (!gtag) return

  const userData: Record<string, unknown> = {}

  if (input.email) {
    userData.sha256_email_address = await sha256Hex(
      normaliseEmailForHash(input.email)
    )
  }
  if (input.phone) {
    userData.sha256_phone_number = await sha256Hex(
      normalisePhoneForHash(input.phone)
    )
  }

  const address: Record<string, unknown> = {}
  if (input.firstName) {
    address.sha256_first_name = await sha256Hex(
      input.firstName.trim().toLowerCase()
    )
  }
  if (input.lastName) {
    address.sha256_last_name = await sha256Hex(
      input.lastName.trim().toLowerCase()
    )
  }
  if (input.street) address.street = input.street.trim()
  if (input.city) address.city = input.city.trim()
  if (input.region) address.region = input.region.trim()
  if (input.postalCode) address.postal_code = input.postalCode.trim()
  if (input.country) address.country = input.country.trim().toUpperCase()

  if (Object.keys(address).length > 0) {
    userData.address = address
  }

  if (Object.keys(userData).length === 0) return

  gtag("set", "user_data", userData)
}

export type {
  GA4Item,
  GA4ViewItemData,
  GA4AddToCartData,
  GA4BeginCheckoutData,
  GA4PurchaseData,
}
