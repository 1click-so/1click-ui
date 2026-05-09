"use client"

import { fireCapiEvent, generateEventId } from "./capi"
import type {
  AddToCartData,
  InitiateCheckoutData,
  LeadData,
  PurchaseData,
  ViewContentData,
} from "./types"

/**
 * Typed wrappers around the global `fbq()` from Meta Pixel.
 *
 * Every call ALSO fires a server-side CAPI event with the SAME
 * `event_id` so Meta deduplicates Browser + Server into one
 * conversion. Without dual-fire, ad-blocked / iOS-ATT visitors
 * disappear from Meta's signals — about 30-40% of EU traffic in 2026.
 *
 * Storefront callers don't need to think about event_id (we generate
 * one and pass it to both paths) EXCEPT for Purchase, where the id
 * MUST match the server subscriber's `purchase_${order.display_id}`
 * format so the order.placed CAPI Purchase and the browser-fired
 * Purchase dedupe correctly.
 *
 * All helpers no-op the pixel call when `window.fbq` is undefined
 * (pixel not loaded — SSR, ad-blocker, admin disabled). CAPI fires
 * regardless of pixel state — that's the whole point of dual-fire.
 */

type FbqFn = {
  (command: "init", pixelId: string): void
  /** Re-init with Advanced Matching params (em / ph / fn / ln / ct / zp,
   *  pre-hashed). Per Meta docs the Pixel merges these with any prior
   *  init values and applies them to ALL subsequent track() calls. */
  (
    command: "init",
    pixelId: string,
    advancedMatching: Record<string, string>
  ): void
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

export type ExtraTrackingContext = {
  /** Optional Medusa cart id — backend uses it to enrich user_data
   *  from cart.shipping_address (city, postal, names, phone) so the
   *  CAPI event carries hashed PII even when the storefront only
   *  knows the cart id. */
  cartId?: string
  /** Email if known (e.g. user just typed it in checkout). Hashed
   *  server-side. Skipped if cart enrichment also produces it. */
  email?: string
}

export function trackViewContent(
  data: ViewContentData,
  context: ExtraTrackingContext = {}
): void {
  const eventId = generateEventId("ViewContent")

  const fbq = safeFbq()
  if (fbq) {
    fbq("track", "ViewContent", data as unknown as Record<string, unknown>, {
      eventID: eventId,
    })
  }

  fireCapiEvent("ViewContent", {
    event_id: eventId,
    cart_id: context.cartId,
    user_data: { email: context.email },
    custom_data: data as unknown as Record<string, unknown>,
  })
}

export function trackAddToCart(
  data: AddToCartData,
  context: ExtraTrackingContext = {}
): void {
  const eventId = generateEventId("AddToCart")

  const fbq = safeFbq()
  if (fbq) {
    fbq("track", "AddToCart", data as unknown as Record<string, unknown>, {
      eventID: eventId,
    })
  }

  fireCapiEvent("AddToCart", {
    event_id: eventId,
    cart_id: context.cartId,
    user_data: { email: context.email },
    custom_data: data as unknown as Record<string, unknown>,
  })
}

export function trackInitiateCheckout(
  data: InitiateCheckoutData,
  context: ExtraTrackingContext = {}
): void {
  const eventId = generateEventId("InitiateCheckout")

  const fbq = safeFbq()
  if (fbq) {
    fbq(
      "track",
      "InitiateCheckout",
      data as unknown as Record<string, unknown>,
      { eventID: eventId }
    )
  }

  fireCapiEvent("InitiateCheckout", {
    event_id: eventId,
    cart_id: context.cartId,
    user_data: { email: context.email },
    custom_data: data as unknown as Record<string, unknown>,
  })
}

/**
 * Purchase event — eventID MUST equal `purchase_${order.display_id}`
 * to dedupe with the order.placed CAPI subscriber. Caller passes
 * `order.display_id`; this helper builds the id so the format can
 * never drift between the two sides.
 *
 * Browser-fired CAPI Purchase is intentional even though the
 * subscriber also fires server-side: if the server pipeline is
 * delayed or drops, the browser path still delivers the conversion.
 * Dedup collapses the duplicate.
 */
export function trackPurchase(
  data: PurchaseData,
  orderDisplayId: string | number,
  context: ExtraTrackingContext = {}
): void {
  const eventId = `purchase_${orderDisplayId}`

  const fbq = safeFbq()
  if (fbq) {
    fbq("track", "Purchase", data as unknown as Record<string, unknown>, {
      eventID: eventId,
    })
  }

  fireCapiEvent("Purchase", {
    event_id: eventId,
    cart_id: context.cartId,
    user_data: { email: context.email },
    custom_data: data as unknown as Record<string, unknown>,
  })
}

export type LeadContext = ExtraTrackingContext & {
  /** Override the auto-generated event id. Used by callers that need
   *  to send the same id to a backend route so server-side CAPI can
   *  dedupe with the browser-fired Pixel + browser-CAPI events. */
  eventId?: string
  /** Free-text label for the lead source — e.g. "popup_welcome10" or
   *  "newsletter_footer". Surfaces in Meta as `content_name`. */
  contentName?: string
  /** Optional intent slug from popup (intent_picker option). Surfaces
   *  as a custom_data field so audiences can segment on it. */
  intent?: string
}

/**
 * Lead event — fired when a visitor submits the marketing popup or
 * any newsletter signup form. Highest-intent pre-purchase signal.
 * Without this Meta has no way to optimize ad delivery for "likely
 * subscribers" or build a Lead lookalike audience from our funnel.
 *
 * Returns the eventId so the caller can pass it to the backend
 * subscribe route — the server fires its own CAPI Lead with the same
 * id, and Meta dedupes Browser Pixel + Browser CAPI + Server CAPI
 * into one conversion. Belt-and-suspenders: server fire ensures the
 * event lands even when the browser is ad-blocker-killed.
 */
export function trackLead(
  data: LeadData = {},
  context: LeadContext = {}
): string {
  const eventId = context.eventId ?? generateEventId("Lead")

  const fbq = safeFbq()
  if (fbq) {
    fbq("track", "Lead", data as unknown as Record<string, unknown>, {
      eventID: eventId,
    })
  }

  fireCapiEvent("Lead", {
    event_id: eventId,
    cart_id: context.cartId,
    user_data: { email: context.email },
    custom_data: {
      ...(data as unknown as Record<string, unknown>),
      ...(context.contentName ? { content_name: context.contentName } : {}),
      ...(context.intent ? { intent: context.intent } : {}),
    },
  })

  return eventId
}
