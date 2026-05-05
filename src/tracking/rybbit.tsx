"use client"

import Script from "next/script"

/**
 * Rybbit — privacy-friendly self-hosted analytics tracker injector.
 *
 * Loads `<baseUrl>/api/script.js` via Next.js `<Script
 * strategy="afterInteractive">`. The script auto-fires pageviews on
 * initial load and on SPA route changes, so storefronts don't need
 * to wire route-change effects.
 *
 * `siteId` and `baseUrl` are platform-managed — sourced from the Medusa
 * backend env (`RYBBIT_SITE_ID`, optional `RYBBIT_BASE_URL`) and exposed
 * to the storefront via `GET /store/integrations` as
 * `tracking.rybbit = { siteId, baseUrl? }`. The merchant never sees or
 * configures these values; they're set once per store at provisioning
 * time.
 *
 * Renders nothing when `siteId` is falsy — every consuming layout can
 * call this unconditionally.
 */
export function Rybbit({
  siteId,
  baseUrl = "https://analytics.fam.social",
}: {
  siteId?: string
  baseUrl?: string
}) {
  if (!siteId) return null

  return (
    <Script
      id="rybbit-tracker"
      src={`${baseUrl}/api/script.js`}
      data-site-id={siteId}
      strategy="afterInteractive"
    />
  )
}
