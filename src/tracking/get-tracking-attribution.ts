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
  let gaCookieRaw: string | undefined
  let gaSessionCookieRaw: string | undefined

  try {
    const cookieStore = await cookies()
    fbp = cookieStore.get("_fbp")?.value
    fbc = cookieStore.get("_fbc")?.value
    gaCookieRaw = cookieStore.get("_ga")?.value

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
