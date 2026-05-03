/**
 * Shared tracking types — Meta Pixel + Conversions API + Google Analytics 4.
 *
 * Mirrors the backend contract at
 * `medusa-mindpages/src/api/store/integrations/route.ts` (config) and
 * `medusa-mindpages/src/subscribers/tracking-events.ts` (CAPI Purchase
 * + GA4 Measurement Protocol Purchase).
 *
 * Server CAPI uses `event_id = "purchase_${order.display_id}"` — clients
 * MUST pass the same value as `eventID` on `fbq('track', 'Purchase', ...)`
 * for Meta to deduplicate Browser + Server events.
 *
 * GA4 Measurement Protocol uses `transaction_id = String(order.display_id)`
 * — GA4 dedupes by transaction_id automatically.
 */

export type TrackingConfig = {
  facebookPixel?: { pixelId: string }
  gtm?: { containerId: string }
  ga4?: { measurementId: string }
  klaviyo?: { publicKey: string }
}

export type TrackingConfigResponse = {
  tracking: TrackingConfig
}

/** A single line item passed in `contents`. Meta requires `id` + `quantity`. */
export type MetaContentItem = {
  id: string
  quantity: number
  item_price?: number
}

export type ViewContentData = {
  content_ids: string[]
  content_type: "product" | "product_group"
  currency: string
  value: number
}

export type AddToCartData = {
  content_ids: string[]
  content_type: "product" | "product_group"
  currency: string
  value: number
  contents: MetaContentItem[]
}

export type InitiateCheckoutData = {
  content_ids: string[]
  content_type: "product" | "product_group"
  currency: string
  value: number
  num_items: number
  contents: MetaContentItem[]
}

export type PurchaseData = {
  content_ids: string[]
  content_type: "product" | "product_group"
  currency: string
  value: number
  num_items: number
  contents: MetaContentItem[]
}

/**
 * Attribution payload written to `cart.metadata` before completion.
 * Backend subscriber reads exactly these keys from `order.metadata`.
 *
 * - fb_fbp / fb_fbc: from _fbp / _fbc cookies (set by fbq init)
 * - fb_user_agent: from request User-Agent header
 * - fb_client_ip: from request x-forwarded-for / x-real-ip
 * - fb_event_source_url: from request Referer
 * - ga_client_id: from _ga cookie value, "GA1.1." prefix stripped
 * - ga_session_id: parsed from _ga_<MEASUREMENT_ID> cookie's session segment
 * - ga_engagement_time_msec: client-tracked time-on-session in ms
 *   (passed in via clientHints on placeOrder, not derivable server-side)
 */
export type TrackingAttribution = {
  fb_fbp?: string
  fb_fbc?: string
  fb_user_agent?: string
  fb_client_ip?: string
  fb_event_source_url?: string
  ga_client_id?: string
  ga_session_id?: string
  ga_engagement_time_msec?: number
}

/**
 * Client-only attribution data — must be passed through to placeOrder by
 * the storefront because it can't be read from cookies/headers on the
 * server (the browser computes it during the session).
 */
export type TrackingClientHints = {
  /** Accumulated time-on-session in ms (Date.now() - sessionStart). */
  engagementTimeMsec?: number
}
