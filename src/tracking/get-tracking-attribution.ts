import "server-only"

import { cookies, headers } from "next/headers"

import { getTrackingConfig } from "./get-tracking-config"
import type { TrackingAttribution, TrackingClientHints } from "./types"

/**
 * Reads Meta + GA4 attribution signals from the current Next.js server
 * request and returns the payload to write into `cart.metadata` before
 * completion. The backend `order.placed` subscriber reads exactly these
 * keys to build the CAPI Purchase event's `user_data` and the GA4
 * Measurement Protocol Purchase's `client_id` / `session_id`.
 *
 * Server-readable (this function reads from cookies/headers):
 *   - fb_fbp, fb_fbc            — _fbp / _fbc cookies (set by fbq init)
 *   - fb_user_agent             — User-Agent request header
 *   - fb_client_ip              — x-forwarded-for / x-real-ip header
 *   - fb_event_source_url       — Referer header
 *   - ga_client_id              — _ga cookie, "GA1.1." prefix stripped
 *   - ga_session_id             — _ga_<MEASUREMENT_ID> cookie, session segment
 *
 * Client-only (passed via `clientHints` because the browser computes it):
 *   - ga_engagement_time_msec   — accumulated time-on-session in ms
 *
 * Returns an object with only the fields that resolved (no undefined
 * keys), so spreading into existing metadata won't clobber other values.
 */
export async function getTrackingAttribution(
  clientHints?: TrackingClientHints
): Promise<TrackingAttribution> {
  const result: TrackingAttribution = {}

  // Cookies (best-effort — throws outside a request context)
  let fbp: string | undefined
  let fbc: string | undefined
  let anonId: string | undefined
  let gaCookieRaw: string | undefined
  let gaSessionCookieRaw: string | undefined

  let utmFirstRaw: string | undefined
  let utmLastRaw: string | undefined

  try {
    const cookieStore = await cookies()
    fbp = cookieStore.get("_fbp")?.value
    fbc = cookieStore.get("_fbc")?.value
    // _1c_anon — our self-managed per-browser visitor id, written by
    // attribution.ts on first tracking call. Surfaces server-side here
    // so the order.placed CAPI Purchase can include it as external_id
    // (alongside customer_id when both exist — Meta accepts an array).
    anonId = cookieStore.get("_1c_anon")?.value
    gaCookieRaw = cookieStore.get("_ga")?.value
    // _1c_utm_first / _1c_utm_last — JSON-encoded UTM tuples written
    // by browser-side captureUtmsFromUrl(). First-touch records the
    // acquisition campaign (365-day TTL); last-touch records the
    // closer (90-day TTL, refreshed on each UTM-bearing visit).
    utmFirstRaw = cookieStore.get("_1c_utm_first")?.value
    utmLastRaw = cookieStore.get("_1c_utm_last")?.value

    // _ga_<MEASUREMENT_ID> uses the GA4 measurementId (e.g., G-ABCDEF1234)
    // with the "G-" prefix stripped: cookie name = `_ga_ABCDEF1234`.
    // Look it up only if the public config exposes a measurementId.
    const config = await getTrackingConfig()
    const measurementId = config.ga4?.measurementId
    if (measurementId) {
      const cookieName = `_ga_${measurementId.replace(/^G-/, "")}`
      gaSessionCookieRaw = cookieStore.get(cookieName)?.value
    }
  } catch {
    // best-effort — fall through with what we have
  }

  if (fbp) result.fb_fbp = fbp
  if (fbc) result.fb_fbc = fbc
  if (anonId) result.fb_anon_id = anonId

  // Flatten UTM cookies into utm_first_* / utm_last_* keys so the
  // backend (and the order.metadata writeback that follows) can read
  // them with simple JSON path queries — no jsonb_path_query needed.
  // Missing keys are dropped from `result` (not set to undefined) so a
  // partial-touch (e.g. utm_source only) doesn't pollute metadata with
  // null fields.
  applyUtmCookie(utmFirstRaw, "utm_first", result)
  applyUtmCookie(utmLastRaw, "utm_last", result)

  // _ga cookie format: "GA1.1.<client_id>.<timestamp>" — backend wants
  // the full <client_id>.<timestamp> portion (the canonical GA client_id).
  if (gaCookieRaw) {
    const parts = gaCookieRaw.split(".")
    // GA1 / GS1 schemas: cookie is "<schema>.<sequence>.<id>.<ts>" — the
    // canonical client_id is the last two segments joined with a dot.
    if (parts.length >= 4) {
      result.ga_client_id = `${parts[2]}.${parts[3]}`
    } else {
      result.ga_client_id = gaCookieRaw
    }
  }

  // _ga_<MEASUREMENT_ID> format: "GS1.1.<session_id>.<count>.<engaged>.<session_start>.<scroll>.<engagement_time>.0"
  // session_id is at index 2.
  if (gaSessionCookieRaw) {
    const parts = gaSessionCookieRaw.split(".")
    if (parts.length >= 3 && parts[2]) {
      result.ga_session_id = parts[2]
    }
  }

  // Headers (best-effort)
  try {
    const headerStore = await headers()
    const ua = headerStore.get("user-agent")
    if (ua) result.fb_user_agent = ua

    // x-forwarded-for can be a chain of proxies; leftmost is the original client.
    const xff = headerStore.get("x-forwarded-for")
    const xri = headerStore.get("x-real-ip")
    const ip = xff?.split(",")[0]?.trim() || xri || undefined
    if (ip) result.fb_client_ip = ip

    const referer = headerStore.get("referer")
    if (referer) result.fb_event_source_url = referer
  } catch {
    // best-effort
  }

  // Client hints (engagement time — browser only)
  if (
    clientHints?.engagementTimeMsec !== undefined &&
    clientHints.engagementTimeMsec >= 0
  ) {
    result.ga_engagement_time_msec = clientHints.engagementTimeMsec
  }

  return result
}

// ── UTM cookie parsing ───────────────────────────────────────────────

type ParsedUtmCookie = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  captured_at?: number
}

/**
 * Decode a `_1c_utm_first` or `_1c_utm_last` cookie value (URI-encoded
 * JSON) and flatten its fields onto the attribution result with the
 * given prefix ("utm_first" or "utm_last"). Missing/blank UTM fields
 * are dropped from `out` rather than written as undefined so a
 * partial-touch never pollutes order.metadata with empty keys.
 *
 * Defensive against:
 *   - Missing cookie (raw=undefined) → no-op
 *   - Invalid URI encoding → caught + no-op
 *   - Invalid JSON → caught + no-op
 *   - Schema drift (captured_at missing or non-number) → no-op
 *
 * Treating malformed cookies as missing is the right call: a hostile
 * or stale cookie shouldn't be able to inject keys into order.metadata
 * via the type cast at the writeback boundary.
 */
function applyUtmCookie(
  raw: string | undefined,
  prefix: "utm_first" | "utm_last",
  out: TrackingAttribution
): void {
  if (!raw) return
  let parsed: ParsedUtmCookie | null = null
  try {
    parsed = JSON.parse(decodeURIComponent(raw)) as ParsedUtmCookie
  } catch {
    return
  }
  if (!parsed || typeof parsed.captured_at !== "number") return

  // Spelling-out each field keeps the type system honest (rather than
  // a string-keyed loop that would require `as any`).
  if (parsed.utm_source) {
    out[`${prefix}_source` as const] = parsed.utm_source
  }
  if (parsed.utm_medium) {
    out[`${prefix}_medium` as const] = parsed.utm_medium
  }
  if (parsed.utm_campaign) {
    out[`${prefix}_campaign` as const] = parsed.utm_campaign
  }
  if (parsed.utm_term) {
    out[`${prefix}_term` as const] = parsed.utm_term
  }
  if (parsed.utm_content) {
    out[`${prefix}_content` as const] = parsed.utm_content
  }
  out[`${prefix}_captured_at` as const] = parsed.captured_at
}
