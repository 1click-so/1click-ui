"use client"

import Script from "next/script"

/**
 * GA4 — Google Analytics 4 base script loader.
 *
 * Loads `https://www.googletagmanager.com/gtag/js?id=<measurementId>` via
 * Next.js `<Script strategy="afterInteractive">` and initialises gtag with
 * the given measurement ID. Once loaded, gtag automatically sets the
 * `_ga` and `_ga_<MEASUREMENT_ID>` first-party cookies, which the server
 * action `getTrackingAttribution` then reads on cart completion to
 * forward `ga_client_id` / `ga_session_id` into the order metadata for
 * GA4 Measurement Protocol Purchase events.
 *
 * Renders nothing when `measurementId` is falsy — every consuming layout
 * can call this unconditionally; the script is only injected when the
 * admin has configured GA4.
 *
 * `send_page_view: true` (default) — initial page_view fires automatically
 * on script load. Subsequent SPA route changes are NOT auto-tracked by
 * gtag; storefronts that need per-route page_views should call
 * `gtag('event', 'page_view', { page_path })` from a route-change effect.
 */
export function GA4({ measurementId }: { measurementId?: string }) {
  if (!measurementId) return null

  const initSnippet = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');
`.trim()

  return (
    <>
      <Script
        id="ga4-loader"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <Script
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: initSnippet }}
      />
    </>
  )
}
