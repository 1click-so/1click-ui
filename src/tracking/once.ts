"use client"

/**
 * once — "fire this tracking event at most once per cart" guard.
 *
 * Why this exists:
 *
 *   Mid-funnel checkout events (add_shipping_info, add_payment_info)
 *   are driven by FORM STATE, not by a one-shot user action. The
 *   customer can switch delivery method, toggle card ↔ cash-on-delivery,
 *   correct a typo in their address, or refresh the page — each of
 *   which re-runs the effect that would fire the event. Without a
 *   guard, one shopper generates a dozen add_payment_info events,
 *   which wrecks funnel ratios in GA4/Rybbit and teaches Meta's
 *   optimizer that this event is cheap and meaningless.
 *
 *   A `useRef` guard is NOT enough: it lives in React memory and
 *   resets on every remount, so a page refresh (or an SPA navigation
 *   back into checkout) re-fires. Persistence has to outlive the
 *   component.
 *
 * Design:
 *
 *   - Keyed by `${event}:${cartId}` so a genuinely NEW cart (the
 *     shopper bought, then started a second order) is allowed to fire
 *     its own events. Same cart never fires twice.
 *   - `sessionStorage`, not `localStorage`: the guard should expire
 *     when the browsing session does. A shopper returning tomorrow to
 *     the same abandoned cart is a new session and legitimately
 *     re-enters the funnel.
 *   - In-memory Set mirrors the store so repeated calls within one
 *     page never touch sessionStorage (Safari throws on quota /
 *     private mode; we degrade to memory-only rather than fire twice).
 *
 * Belt-and-suspenders: callers pair this with a DETERMINISTIC
 * `event_id` (see `checkoutStepEventId`) so that even if the guard is
 * defeated — two tabs open on the same cart, sessionStorage cleared
 * mid-session — Meta still collapses the duplicates server-side by
 * event_id, exactly as it does for `purchase_${display_id}`.
 */

const STORAGE_KEY = "_1c_fired_events"

/** Mirrors sessionStorage so repeat calls in one page skip storage I/O. */
const memory = new Set<string>()

function readStore(): Set<string> {
  if (memory.size > 0) return memory
  if (typeof window === "undefined") return memory
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        for (const k of parsed) if (typeof k === "string") memory.add(k)
      }
    }
  } catch {
    // Private mode / quota / corrupt JSON — memory-only from here.
  }
  return memory
}

function persist(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(memory))
    )
  } catch {
    // Storage unavailable — the in-memory Set still dedupes this page.
  }
}

/**
 * Returns true the FIRST time it's called for a given (event, cartId)
 * pair and false every time after, marking the pair as fired.
 *
 * Callers should treat it as the gate itself:
 *
 *   if (!markFiredOnce("add_payment_info", cart.id)) return
 *   trackAddPaymentInfo(...)
 *
 * Returns false when `cartId` is missing — a checkout-step event with
 * no cart to key on cannot be deduped, and firing an undedupable event
 * is worse than dropping it.
 */
export function markFiredOnce(event: string, cartId: string | undefined | null): boolean {
  if (!cartId) return false
  if (typeof window === "undefined") return false

  const key = `${event}:${cartId}`
  const store = readStore()
  if (store.has(key)) return false

  store.add(key)
  persist()
  return true
}

/** Read-only check — does not mark. For conditional UI/debug only. */
export function hasFired(event: string, cartId: string | undefined | null): boolean {
  if (!cartId || typeof window === "undefined") return false
  return readStore().has(`${event}:${cartId}`)
}

/**
 * Deterministic Meta `event_id` for a checkout-step event.
 *
 * Unlike `generateEventId()` (random, for events with no natural key),
 * this derives the id from the cart so the SAME logical action always
 * produces the SAME id. That gives Meta a server-side dedup key: two
 * tabs, a restored session, or a retried request all collapse into one
 * conversion instead of inflating the count.
 *
 * Same principle as Purchase's `purchase_${display_id}`.
 */
export function checkoutStepEventId(event: string, cartId: string): string {
  return `${event}_${cartId}`
}
