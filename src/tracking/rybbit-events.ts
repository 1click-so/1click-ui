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
 * Script-load race resilience (added v2.2.6):
 *
 *   The Rybbit tracker is loaded by `<Rybbit>` via Next.js Script with
 *   strategy="afterInteractive" — `window.rybbit` is undefined for the
 *   first 50-800ms after page load while the script downloads. During
 *   that window, useEffect-mounted tracking calls would previously
 *   silently no-op (`safeRybbit()` returned null and the caller had no
 *   way to retry).
 *
 *   This file now maintains a small per-page queue: when fireEvent is
 *   called before `window.rybbit` exists, the call is pushed onto a
 *   module-level queue and a single drainer is scheduled that polls
 *   for `window.rybbit` and replays everything once the script loads.
 *
 *   The drainer caps total wait at 10 seconds — beyond that the script
 *   is presumed permanently blocked (ad-blocker, CSP rejection, network
 *   failure) and the queue is discarded so we don't leak memory.
 *
 *   This is the canonical pattern for async tag loaders — same as
 *   Google's `window.dataLayer` (queue → consumed by gtag.js on load)
 *   and Segment's `analytics.js` snippet (method-stub queue → flushed
 *   on script ready).
 *
 *   IMPORTANT: server-side firing (e.g. Rybbit Purchase from the
 *   `order.placed` subscriber in medusa-mindpages) remains the truth
 *   source for high-value conversions. This queue improves browser-side
 *   funnel events (view_item / add_to_cart / begin_checkout) where the
 *   server doesn't fire. Purchase still has the server flag guard.
 *
 * All helpers stay no-op-safe when called outside a browser (SSR) and
 * when Rybbit is admin-disabled (the `<Rybbit>` component renders
 * nothing for missing siteId, so `window.rybbit` simply never appears
 * and the 10s drain timeout discards the queue silently).
 *
 * Event names match GA4 / industry vocabulary so the same dashboard
 * names work across analytics tools:
 *   view_item · add_to_cart · begin_checkout · purchase
 */

export type RybbitEventProps = Record<string, string | number>

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

// ── Script-load race queue ────────────────────────────────────────────

type PendingEvent = { name: string; props?: RybbitEventProps }

/** Calls made before `window.rybbit` exists wait here. Module-level so
 *  every fireEvent() across the page shares the same queue. */
const pendingQueue: PendingEvent[] = []

/** Single in-flight drainer guard — prevents N parallel pollers if N
 *  events queue during the same script-load window. */
let drainScheduled = false

const DRAIN_FIRST_DELAY_MS = 50
const DRAIN_POLL_INTERVAL_MS = 100
const DRAIN_MAX_WAIT_MS = 10_000

/**
 * Fire an event immediately if Rybbit is ready, or queue + schedule a
 * drain otherwise. All public helpers below go through this so the
 * queue covers every event type uniformly — no caller has to know
 * whether the script has loaded yet.
 */
function fireEvent(name: string, props?: RybbitEventProps): void {
  const r = safeRybbit()
  if (r) {
    try {
      r.event(name, props)
    } catch {
      // Defensive — Rybbit's event() throwing would be unusual but
      // tracking failures must never break the user flow.
    }
    return
  }
  if (typeof window === "undefined") return // SSR — drop silently
  pendingQueue.push({ name, props })
  scheduleDrain()
}

/**
 * Poll for `window.rybbit` and drain the queue when it appears.
 * Bounded — gives up after DRAIN_MAX_WAIT_MS so a permanently-blocked
 * Rybbit (ad-blocker, CSP, offline) doesn't grow the queue forever.
 */
function scheduleDrain(): void {
  if (drainScheduled) return
  if (typeof window === "undefined") return
  drainScheduled = true

  const startedAt = Date.now()
  const tick = (): void => {
    const r = safeRybbit()
    if (r) {
      const drained = pendingQueue.splice(0, pendingQueue.length)
      for (const ev of drained) {
        try {
          r.event(ev.name, ev.props)
        } catch {
          // Don't let one bad event stop the rest from draining
        }
      }
      drainScheduled = false
      return
    }
    if (Date.now() - startedAt > DRAIN_MAX_WAIT_MS) {
      // Rybbit will not load (ad-blocker, CSP, network failure, admin
      // disabled). Discard the queue so we don't leak memory if the
      // user navigates around the SPA with the script permanently dead.
      pendingQueue.length = 0
      drainScheduled = false
      return
    }
    setTimeout(tick, DRAIN_POLL_INTERVAL_MS)
  }
  setTimeout(tick, DRAIN_FIRST_DELAY_MS)
}

// ── Public event helpers ──────────────────────────────────────────────

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

/**
 * Mid-funnel checkout steps. Names match GA4's recommended events so
 * the same funnel reads identically in Rybbit and GA4.
 *
 * `shipping_tier` / `payment_type` are optional in GA4's spec and stay
 * optional here — Rybbit drops undefined props rather than sending
 * empty strings.
 */
export type RybbitAddShippingInfoData = {
  item_ids: string[]
  num_items: number
  currency: string
  value: number
  shipping_tier?: string
}

export type RybbitAddPaymentInfoData = {
  item_ids: string[]
  num_items: number
  currency: string
  value: number
  payment_type?: string
}

export type RybbitPurchaseData = {
  transaction_id: string
  item_ids: string[]
  num_items: number
  currency: string
  value: number
}

export function trackRybbitViewItem(data: RybbitViewItemData): void {
  fireEvent("view_item", {
    item_id: data.item_id,
    item_name: data.item_name,
    currency: data.currency,
    value: data.value,
  })
}

export function trackRybbitAddToCart(data: RybbitAddToCartData): void {
  fireEvent("add_to_cart", {
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
  fireEvent("begin_checkout", {
    item_ids: joinIds(data.item_ids),
    num_items: data.num_items,
    currency: data.currency,
    value: data.value,
  })
}

export function trackRybbitAddShippingInfo(
  data: RybbitAddShippingInfoData
): void {
  fireEvent("add_shipping_info", {
    item_ids: joinIds(data.item_ids),
    num_items: data.num_items,
    currency: data.currency,
    value: data.value,
    // Rybbit only accepts string|number — omit rather than send "".
    ...(data.shipping_tier ? { shipping_tier: data.shipping_tier } : {}),
  })
}

export function trackRybbitAddPaymentInfo(
  data: RybbitAddPaymentInfoData
): void {
  fireEvent("add_payment_info", {
    item_ids: joinIds(data.item_ids),
    num_items: data.num_items,
    currency: data.currency,
    value: data.value,
    ...(data.payment_type ? { payment_type: data.payment_type } : {}),
  })
}

/**
 * Purchase event — fired client-side on the order-confirmed page.
 *
 * Browser-side Purchase is now redundant when the server-side fire
 * has succeeded (medusa-mindpages tracking-events.ts subscriber sets
 * `order.metadata.rybbit_purchase_fired`). The storefront's
 * `<TrackPurchase>` reads that flag and skips this call when true.
 * Server-side is the truth source; this browser-side call is the
 * realtime safety net for the very first /confirmed visit when the
 * subscriber hasn't finished yet.
 *
 * Even on first-visit, the queue above means a script-load race no
 * longer drops the event — it'll fire as soon as Rybbit loads.
 */
export function trackRybbitPurchase(data: RybbitPurchaseData): void {
  fireEvent("purchase", {
    transaction_id: data.transaction_id,
    item_ids: joinIds(data.item_ids),
    num_items: data.num_items,
    currency: data.currency,
    value: data.value,
  })
}
