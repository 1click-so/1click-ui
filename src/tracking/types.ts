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
  rybbit?: { siteId: string; baseUrl?: string }
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
 * Mid-funnel checkout-step payloads (Meta side).
 *
 * These fill the gap between InitiateCheckout and Purchase. Per Meta's
 * standard-event reference, `AddPaymentInfo` accepts `content_ids`,
 * `contents`, `currency` and `value` — ALL OPTIONAL. We still send them
 * because value-based optimization and catalog matching need them, but
 * the types mirror Meta's spec so a caller with partial data is valid.
 *
 * `AddShippingInfo` has no Meta standard equivalent (Meta's `Contact`
 * means "customer contacted the business" — a support event, not a
 * checkout step). It ships as a Pixel CUSTOM event via `trackCustom`,
 * which Meta supports as a first-class optimization target once a
 * Custom Conversion is defined for it in Events Manager.
 */
export type AddShippingInfoData = {
  content_ids?: string[]
  content_type?: "product" | "product_group"
  currency?: string
  value?: number
  num_items?: number
  contents?: MetaContentItem[]
  /** Delivery option chosen, when already known at fire time (e.g.
   *  "econt_office", "boxnow_locker"). Mirrors GA4's `shipping_tier`. */
  shipping_tier?: string
}

export type AddPaymentInfoData = {
  content_ids?: string[]
  content_type?: "product" | "product_group"
  currency?: string
  value?: number
  num_items?: number
  contents?: MetaContentItem[]
  /** How the customer chose to pay. Cash-on-delivery IS a payment type
   *  under both Meta's and GA4's definitions — the customer completed
   *  the payment-selection step, they just didn't enter card details. */
  payment_type?: string
}

/**
 * Lead event payload — shape per Meta's Lead standard event spec.
 * All fields optional (Meta accepts an empty Lead). Storefront wraps
 * popup signups + newsletter forms in a Lead event so Meta can
 * optimize ad delivery for "likely subscribers" and build Lead
 * lookalike audiences from our funnel.
 */
export type LeadData = {
  /** Optional lead value (e.g. expected LTV for a subscriber). */
  value?: number
  currency?: string
  /** Free-text label describing what the visitor signed up for —
   *  e.g. "newsletter_popup", "newsletter_footer". */
  content_name?: string
  content_category?: string
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
  /** Per-browser anonymous visitor id (cookie `_1c_anon`). Backend
   *  uses this as `external_id` on the Purchase CAPI when no
   *  customer_id is available, AND alongside customer_id when both
   *  are known (Meta accepts external_id as an array, so dedup +
   *  cross-session attribution both improve). */
  fb_anon_id?: string
  ga_client_id?: string
  ga_session_id?: string
  ga_engagement_time_msec?: number

  // ── UTM attribution ────────────────────────────────────────────────
  // Captured by browser-side `captureUtmsFromUrl()` (attribution.ts)
  // into `_1c_utm_first` / `_1c_utm_last` cookies, then read here at
  // checkout completion. Flat keys (instead of nested objects) so a
  // raw `SELECT metadata->>'utm_first_source' FROM "order"` query
  // works without `jsonb_path_query`. Each tuple's `captured_at` is
  // Unix seconds — `attribution_window_days = (order.created_at_unix
  // - captured_at) / 86400`.

  /** Acquisition (first-touch) UTM source — the campaign that
   *  originally brought this visitor in. 365-day TTL. Stable across
   *  multiple ad-click revisits. */
  utm_first_source?: string
  utm_first_medium?: string
  utm_first_campaign?: string
  utm_first_term?: string
  utm_first_content?: string
  utm_first_captured_at?: number

  /** Closer (last-touch) UTM source — the campaign whose click
   *  immediately preceded this order. 90-day TTL, refreshed on every
   *  UTM-bearing visit. Aligns with Meta / Google Ads attribution
   *  windows. */
  utm_last_source?: string
  utm_last_medium?: string
  utm_last_campaign?: string
  utm_last_term?: string
  utm_last_content?: string
  utm_last_captured_at?: number
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
