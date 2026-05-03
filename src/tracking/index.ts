/**
 * @1click/ui/tracking — Meta Pixel + Conversions API + Google Analytics 4.
 *
 * Public surface:
 *   - <MetaPixel pixelId> / <GA4 measurementId> — drop into a layout
 *   - Meta Pixel client helpers:
 *       trackViewContent / trackAddToCart / trackInitiateCheckout / trackPurchase
 *   - GA4 client helpers (Google Enhanced Ecommerce):
 *       trackGAViewItem / trackGAAddToCart / trackGABeginCheckout / trackGAPurchase
 *   - getTrackingConfig() — server fetch for the public pixel/measurement IDs
 *   - getTrackingAttribution(clientHints?) — server function gathering
 *     fb_* and ga_* signals from cookies/headers + caller-provided
 *     engagement time, for cart.metadata writeback before order completion
 *   - getEngagementTimeMsec() / initEngagementTime() — browser helpers
 *     for tracking time-on-session
 *
 * Server vs client split (per Next.js App Router rules):
 *   - get-tracking-config.ts and get-tracking-attribution.ts use `server-only`
 *   - meta-pixel.tsx, ga4.tsx, fbq.ts, gtag.ts, use-engagement-time.ts
 *     are `"use client"`
 *   - types.ts is universal
 *
 * Importers should usually pull from the subpath that matches their
 * environment. The barrel re-exports everything, but tree-shaking and
 * Next.js's RSC boundary detection both work better with subpaths.
 */

export { MetaPixel } from "./meta-pixel"
export { GA4 } from "./ga4"
export {
  trackViewContent,
  trackAddToCart,
  trackInitiateCheckout,
  trackPurchase,
} from "./fbq"
export {
  trackGAViewItem,
  trackGAAddToCart,
  trackGABeginCheckout,
  trackGAPurchase,
} from "./gtag"
export { getTrackingConfig } from "./get-tracking-config"
export { getTrackingAttribution } from "./get-tracking-attribution"
export {
  getEngagementTimeMsec,
  initEngagementTime,
} from "./use-engagement-time"

export type {
  TrackingConfig,
  TrackingConfigResponse,
  TrackingAttribution,
  TrackingClientHints,
  MetaContentItem,
  ViewContentData,
  AddToCartData,
  InitiateCheckoutData,
  PurchaseData,
} from "./types"

export type {
  GA4Item,
  GA4ViewItemData,
  GA4AddToCartData,
  GA4BeginCheckoutData,
  GA4PurchaseData,
} from "./gtag"
