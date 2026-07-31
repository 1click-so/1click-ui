"use client"

import {
  getOrCreateAnonId,
  getOrCreateFbc,
  getOrCreateFbp,
  getKnownVisitor,
} from "./attribution"

/**
 * Browser-side CAPI client.
 *
 * Pairs with the backend route `POST /store/integrations/facebook/event`
 * (medusa-mindpages/src/api/store/integrations/facebook/event/route.ts).
 *
 * Why we fire CAPI from the browser AND from the server:
 *   - Pixel can be blocked by ad-blockers, iOS 14 ATT, content blockers.
 *   - CAPI sent from the SERVER hits Meta from the merchant's IP, with
 *     server-derived signals (user IP, UA from headers, fbp/fbc from
 *     cookies the storefront forwards).
 *   - For dedup to work, BOTH must carry the SAME `event_id`. Meta dedupes
 *     by event_name + event_id within a window (~3 days for Purchase).
 *
 * This module only does the browser → backend POST. Backend enriches
 * IP/UA from headers and forwards to Meta. We send fbp/fbc from cookies
 * because backend can't read first-party cookies set on the storefront
 * domain (different origin from the Medusa backend).
 *
 * Attribution defaults:
 *   - fbp / fbc / external_id / em / ph / fn / ln / ct / st / zp / country
 *     are auto-defaulted from `./attribution` helpers (cookies +
 *     localStorage). Caller-supplied values always take precedence.
 *     This is what fixes the EMQ gaps in Events Manager — every event
 *     ships dedup keys + identity + locale even when the caller doesn't
 *     know to pass them.
 */

const CAPI_PATH = "/store/integrations/facebook/event"

export type CapiUserData = {
  fbp?: string
  fbc?: string
  email?: string
  phone?: string
  /** Single id or array — Meta accepts both. We pass customer_id and
   *  anon_id together when the visitor has signed up so dedup AND
   *  cross-session attribution both improve. */
  external_id?: string | string[]
  first_name?: string
  last_name?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
}

export type CapiEventInput = {
  /** Must match the eventID passed to fbq() for Meta to dedupe. */
  event_id: string
  /** Unix seconds at the moment of user action. Backend honours this
   *  instead of stamping at receive time, eliminating 50-300ms drift
   *  on the wire. Defaults to now() at fireCapiEvent call time. */
  event_time?: number
  /** Defaults to `window.location.href`. */
  event_source_url?: string
  /** When provided, backend enriches user_data from cart.shipping_address. */
  cart_id?: string
  /** Caller-supplied user_data overrides defaults from attribution. */
  user_data?: CapiUserData
  /** Whatever Meta wants for this event (currency, value, content_ids, etc.). */
  custom_data?: Record<string, unknown>
}

type Config = {
  baseUrl: string
  publishableKey: string
}

function getConfig(): Config | null {
  const baseUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  if (!baseUrl || !publishableKey) return null
  return { baseUrl, publishableKey }
}

/**
 * Fire a CAPI event in parallel to the Pixel call. The two MUST
 * carry the same `event_id` for Meta to dedupe.
 *
 * Auto-defaults from attribution.ts:
 *   - fbp / fbc — self-managed cookies with Meta's exact format,
 *     written on first call so the Pixel race-condition doesn't
 *     leave us with empty values
 *   - external_id — anon_id UUID (or appended to caller-supplied
 *     customer_id when both known)
 *   - email / phone / first_name / last_name / city / state / postal_code /
 *     country — read from rememberKnownVisitor's localStorage
 *     (populated when visitor types email in checkout, signs up via
 *     popup, or logs in)
 *
 * Caller can override any default by passing `user_data.<field>`.
 *
 * Fire-and-forget: returns void and never throws. Tracking failures
 * must never break the user flow.
 */
export function fireCapiEvent(
  eventName:
    | "ViewContent"
    | "AddToCart"
    | "InitiateCheckout"
    // Mid-funnel checkout steps. `AddPaymentInfo` is a Meta standard
    // event; `AddShippingInfo` is a custom event (Meta has no standard
    // equivalent). CAPI accepts custom event names verbatim, so both
    // travel the same server-side path.
    | "AddShippingInfo"
    | "AddPaymentInfo"
    | "Purchase"
    | "PageView"
    | "Lead",
  input: CapiEventInput
): void {
  if (typeof window === "undefined") return

  const config = getConfig()
  if (!config) return // Tracking not configured — no-op silently.

  const known = getKnownVisitor()
  const callerExternalId = input.user_data?.external_id
  const anonId = getOrCreateAnonId()
  // When a customer_id was supplied, send BOTH it and the anon_id so
  // Meta can dedupe by either AND link cross-session activity. When
  // only the anon_id is available, send just that.
  const externalId: string | string[] | undefined = callerExternalId
    ? Array.isArray(callerExternalId)
      ? anonId && !callerExternalId.includes(anonId)
        ? [...callerExternalId, anonId]
        : callerExternalId
      : anonId && callerExternalId !== anonId
        ? [callerExternalId, anonId]
        : callerExternalId
    : anonId

  const userData: CapiUserData = {
    fbp: input.user_data?.fbp ?? getOrCreateFbp(),
    fbc: input.user_data?.fbc ?? getOrCreateFbc(),
    external_id: externalId,
    email: input.user_data?.email ?? known.email,
    phone: input.user_data?.phone ?? known.phone,
    first_name: input.user_data?.first_name ?? known.firstName,
    last_name: input.user_data?.last_name ?? known.lastName,
    city: input.user_data?.city ?? known.city,
    state: input.user_data?.state ?? known.state,
    postal_code: input.user_data?.postal_code ?? known.postalCode,
    country: input.user_data?.country ?? known.country,
  }

  const body = {
    event_name: eventName,
    event_id: input.event_id,
    event_time: input.event_time ?? Math.floor(Date.now() / 1000),
    event_source_url: input.event_source_url ?? window.location.href,
    cart_id: input.cart_id,
    user_data: userData,
    custom_data: input.custom_data ?? {},
  }

  // `keepalive: true` lets the request survive page unload — critical
  // for InitiateCheckout (fires as user clicks through to checkout)
  // and any event during navigation. Body must be < 64 KB; we send
  // tiny JSON so this is fine.
  fetch(`${config.baseUrl}${CAPI_PATH}`, {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": config.publishableKey,
    },
    body: JSON.stringify(body),
  }).catch(() => {
    // Silent — see fire-and-forget contract above.
  })
}

/**
 * Generate a unique event_id for events that don't have a natural
 * stable id (Purchase uses `purchase_${display_id}`, but ViewContent /
 * AddToCart / InitiateCheckout / PageView don't have one).
 *
 * Format: `<eventName>_<unixSeconds>_<6 hex chars>`.
 * Cryptographic randomness — `crypto.getRandomValues` is universal in
 * 2025 browsers. SSR returns a deterministic placeholder; callers
 * should generate IDs in the browser, not on the server.
 */
export function generateEventId(eventName: string): string {
  const ts = Math.floor(Date.now() / 1000)
  const rand = (() => {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const buf = new Uint8Array(3)
      crypto.getRandomValues(buf)
      return Array.from(buf)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    }
    return Math.random().toString(16).slice(2, 8)
  })()
  return `${eventName.toLowerCase()}_${ts}_${rand}`
}
