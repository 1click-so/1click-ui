"use client"

/**
 * Engagement-time helpers (client only).
 *
 * The GA4 Measurement Protocol Purchase event needs
 * `ga_engagement_time_msec` — how long the user spent in the session
 * before placing the order. This can't be read from a cookie; it has
 * to be tracked by the browser.
 *
 * Strategy: store `sessionStartTs` in `sessionStorage` on first read.
 * On every subsequent call, return `Date.now() - sessionStartTs`.
 * sessionStorage scopes to the tab — closing the tab resets the
 * session, which is the desired behaviour.
 *
 * Cap at 30 minutes to filter out idle/dead-tab sessions. GA4's own
 * session timeout default is 30 minutes, so this matches.
 */

const SESSION_KEY = "tracking_session_start"
const MAX_ENGAGEMENT_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Returns the current engagement time in milliseconds for this session.
 * Returns 0 in non-browser contexts. Always returns a number ≥ 0.
 */
export function getEngagementTimeMsec(): number {
  if (typeof window === "undefined") return 0
  try {
    let start = window.sessionStorage.getItem(SESSION_KEY)
    if (!start) {
      start = String(Date.now())
      window.sessionStorage.setItem(SESSION_KEY, start)
    }
    const elapsed = Date.now() - Number(start)
    if (!Number.isFinite(elapsed) || elapsed < 0) return 0
    return Math.min(elapsed, MAX_ENGAGEMENT_MS)
  } catch {
    return 0
  }
}

/**
 * Initialise the session start timestamp now (no return value). Call
 * from the root layout's MetaPixel/GA4 wrapper so the timer starts on
 * first page view of the session, not on first checkout.
 */
export function initEngagementTime(): void {
  if (typeof window === "undefined") return
  try {
    if (!window.sessionStorage.getItem(SESSION_KEY)) {
      window.sessionStorage.setItem(SESSION_KEY, String(Date.now()))
    }
  } catch {
    // sessionStorage unavailable — Safari private mode etc. Engagement
    // time will be 0 in that case, which the backend treats as "unknown".
  }
}
