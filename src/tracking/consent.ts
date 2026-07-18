/**
 * Consent Mode v2 — shared state + appliers.
 *
 * One first-party cookie (`_1c_consent`) is the single source of truth
 * for the visitor's choice. Three consumers read it:
 *
 *   1. `<ConsentInit>` (consent-init.tsx) — synchronous <head> script
 *      that sets gtag's consent DEFAULT (granted when a stored choice
 *      says so, denied otherwise) BEFORE any Google tag loads. Google's
 *      docs require the default to be set synchronously ahead of the
 *      tag; async = a race where the first hit ships unconsented.
 *   2. `<MetaPixel>` (meta-pixel.tsx) — pushes fbq('consent', …) onto
 *      the queue before fbq('init'), gating the Pixel the same way.
 *   3. `<ConsentBanner>` (consent-banner.tsx) — writes the cookie on
 *      the visitor's choice and applies the live update via
 *      `applyConsent()` below.
 *
 * Advanced consent mode by design: tags always LOAD; while denied,
 *   - gtag sends cookieless pings (GA4 behavioral modeling stays alive)
 *   - fbq queues events client-side and sends nothing until 'grant'
 *
 * Rybbit is deliberately OUTSIDE this system — it is the platform's
 * self-hosted, cookieless analytics and needs no consent gate.
 */

export const CONSENT_COOKIE = "_1c_consent"

/** 12 months — the conventional consent-choice lifetime in the EU. */
export const CONSENT_MAX_AGE_SECONDS = 365 * 24 * 60 * 60

/** window CustomEvent name that re-opens the banner's settings layer
 * (dispatched by `openConsentSettings()`, e.g. from a footer link). */
export const CONSENT_OPEN_EVENT = "1click:consent:open"

export type ConsentChoices = {
  /** analytics_storage */
  analytics: boolean
  /** ad_storage + ad_user_data + ad_personalization (Consent Mode v2
   * treats the three as one merchant-facing "advertising" purpose). */
  ads: boolean
  /** epoch ms of the choice — lets a future policy change re-prompt. */
  ts: number
}

export function readConsentCookie(): ConsentChoices | null {
  if (typeof document === "undefined") return null
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`)
    )
    if (!match?.[1]) return null
    const parsed = JSON.parse(decodeURIComponent(match[1]))
    if (typeof parsed !== "object" || parsed === null) return null
    return {
      analytics: Boolean(parsed.analytics),
      ads: Boolean(parsed.ads),
      ts: Number(parsed.ts) || 0,
    }
  } catch {
    return null
  }
}

export function writeConsentCookie(choices: ConsentChoices): void {
  if (typeof document === "undefined") return
  const value = encodeURIComponent(JSON.stringify(choices))
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`
}

/**
 * Push the visitor's (new) choice to both vendors at runtime.
 *
 * gtag: 'update' after the synchronous 'default' — the documented CMP
 * flow. On grant, subsequent hits carry consented state and gtag writes
 * its cookies; the pre-choice pageview stays cookieless (modeled).
 * fbq: 'grant' flushes the queued events, 'revoke' resumes queueing.
 */
export function applyConsent(choices: ConsentChoices): void {
  if (typeof window === "undefined") return

  const w = window as any
  w.dataLayer = w.dataLayer || []
  // Command-style push — gtag() must receive `arguments`, not an array.
  function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments)
  }

  const ad = choices.ads ? "granted" : "denied"
  gtag("consent", "update", {
    ad_storage: ad,
    ad_user_data: ad,
    ad_personalization: ad,
    analytics_storage: choices.analytics ? "granted" : "denied",
  })
  gtag("set", "ads_data_redaction", !choices.ads)

  if (typeof w.fbq === "function") {
    w.fbq("consent", choices.ads ? "grant" : "revoke")
  }
}

/** Re-open the consent banner (settings layer) from anywhere — e.g. a
 * "Настройки на бисквитките" footer link. No-op if no banner mounted. */
export function openConsentSettings(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT))
}
