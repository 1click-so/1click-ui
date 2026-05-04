"use client"

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
 */

const CAPI_PATH = "/store/integrations/facebook/event"

/**
 * Read a cookie value by name from `document.cookie`. Returns
 * `undefined` on SSR or when the cookie isn't present.
 *
 * `_fbp` and `_fbc` are first-party cookies set by Meta Pixel:
 *   _fbp = fb.1.<timestamp>.<random>          (every visitor)
 *   _fbc = fb.1.<timestamp>.<fbclid value>    (visitors arriving via
 *                                              an ad with ?fbclid=...)
 */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
  if (!match) return undefined
  const value = match.split("=").slice(1).join("=")
  return value || undefined
}

export type CapiUserData = {
  fbp?: string
  fbc?: string
  email?: string
  phone?: string
  external_id?: string
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
  /** Defaults to `window.location.href`. */
  event_source_url?: string
  /** When provided, backend enriches user_data from cart.shipping_address. */
  cart_id?: string
  /** Hashed server-side. Only fields you have. */
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
 * Auto-merges fbp/fbc from cookies if the caller didn't pass them.
 * Defaults `event_source_url` to the current page URL.
 *
 * Fire-and-forget: this returns void and never throws. Tracking
 * failures must never break the user flow. Errors are silently
 * swallowed; the Pixel side still arrives at Meta independently.
 */
export function fireCapiEvent(
  eventName: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase" | "PageView",
  input: CapiEventInput
): void {
  if (typeof window === "undefined") return

  const config = getConfig()
  if (!config) return // Tracking not configured — no-op silently.

  const userData: CapiUserData = {
    fbp: input.user_data?.fbp ?? readCookie("_fbp"),
    fbc: input.user_data?.fbc ?? readCookie("_fbc"),
    email: input.user_data?.email,
    phone: input.user_data?.phone,
    external_id: input.user_data?.external_id,
    first_name: input.user_data?.first_name,
    last_name: input.user_data?.last_name,
    city: input.user_data?.city,
    state: input.user_data?.state,
    country: input.user_data?.country,
    postal_code: input.user_data?.postal_code,
  }

  const body = {
    event_name: eventName,
    event_id: input.event_id,
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
