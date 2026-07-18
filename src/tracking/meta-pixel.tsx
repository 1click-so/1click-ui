"use client"

import Script from "next/script"

import {
  normaliseEmailForHash,
  normalisePhoneForHash,
  rememberKnownVisitor,
  sha256Hex,
  type KnownVisitor,
} from "./attribution"
import { CONSENT_COOKIE } from "./consent"

/**
 * MetaPixel — client-side base pixel injector.
 *
 * Loads `https://connect.facebook.net/en_US/fbevents.js` via Next.js
 * `<Script strategy="afterInteractive">` (the canonical strategy for
 * third-party tags per Next.js docs). Initializes `fbq` with the given
 * pixel ID and fires an initial `PageView`.
 *
 * The snippet stashes `pixelId` on `window.__1click_fb_pixel_id` so
 * `updatePixelAdvancedMatching()` (called later from checkout / popup)
 * can re-init the Pixel with hashed em / ph for Advanced Matching
 * without the caller having to plumb the pixel id through.
 *
 * Renders nothing when `pixelId` is falsy — every consuming layout
 * can call this unconditionally; the script is only injected when the
 * admin has configured Facebook Pixel + CAPI.
 *
 * Subsequent route navigations DON'T need a manual PageView — the
 * single base init covers the initial page; further events are fired
 * explicitly via the helpers in `./fbq.ts`.
 *
 * Consent gate: fbq('consent', …) is pushed from the `_1c_consent`
 * cookie BEFORE fbq('init') — Meta only honors a pre-init revoke, which
 * makes the Pixel queue every event (incl. this PageView) client-side
 * until the <ConsentBanner> grants; a later fbq('consent','grant')
 * flushes the queue. No cookie (first visit) = revoke.
 */
export function MetaPixel({ pixelId }: { pixelId?: string }) {
  if (!pixelId) return null

  const initSnippet = `
window.__1click_fb_pixel_id='${pixelId}';
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
(function(){
  var ads=false;
  try{
    var m=document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=([^;]*)/);
    if(m){ads=!!JSON.parse(decodeURIComponent(m[1])).ads;}
  }catch(e){}
  fbq('consent', ads?'grant':'revoke');
})();
fbq('init', '${pixelId}');
fbq('track', 'PageView');
`.trim()

  return (
    <>
      <Script
        id="meta-pixel-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: initSnippet }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  )
}

declare global {
  interface Window {
    __1click_fb_pixel_id?: string
  }
}

/**
 * Re-initialize the Pixel with Advanced Matching params so EVERY
 * subsequent browser-side event is enriched with hashed em / ph /
 * fn / ln / ct / zp automatically. Per Meta docs, fbq('init') with
 * a 3rd arg merges advanced-matching values rather than replacing
 * them — safe to call repeatedly as new fields become known.
 *
 * Caller passes RAW PII (we hash here using Meta's exact normalization
 * so the resulting hash matches what backend CAPI sends — both sides
 * of dedup compare the same digest).
 *
 * Also persists raw values via rememberKnownVisitor() so the next
 * `fireCapiEvent` picks them up automatically via getKnownVisitor().
 * One call → both Pixel browser-side AND CAPI server-side enriched.
 *
 * No-ops when:
 *   - SSR (no window)
 *   - MetaPixel hasn't mounted yet (no `window.__1click_fb_pixel_id`)
 *   - fbevents.js hasn't loaded yet (no `window.fbq`)
 *
 * The localStorage write still happens in cases 2-3 so the data is
 * available to fireCapiEvent's getKnownVisitor fallback.
 */
export async function updatePixelAdvancedMatching(
  visitor: KnownVisitor
): Promise<void> {
  if (typeof window === "undefined") return

  // Persist raw values regardless of Pixel state — CAPI fallback
  // uses these even when Pixel isn't reachable.
  rememberKnownVisitor(visitor)

  const pixelId = window.__1click_fb_pixel_id
  const fbq = window.fbq
  if (!pixelId || !fbq) return

  const matching: Record<string, string> = {}

  if (visitor.email) {
    matching.em = await sha256Hex(normaliseEmailForHash(visitor.email))
  }
  if (visitor.phone) {
    matching.ph = await sha256Hex(normalisePhoneForHash(visitor.phone))
  }
  if (visitor.firstName) {
    matching.fn = await sha256Hex(visitor.firstName.trim().toLowerCase())
  }
  if (visitor.lastName) {
    matching.ln = await sha256Hex(visitor.lastName.trim().toLowerCase())
  }
  if (visitor.city) {
    matching.ct = await sha256Hex(
      visitor.city.trim().toLowerCase().replace(/\s+/g, "")
    )
  }
  if (visitor.state) {
    matching.st = await sha256Hex(
      visitor.state.trim().toLowerCase().replace(/\s+/g, "")
    )
  }
  if (visitor.postalCode) {
    matching.zp = await sha256Hex(
      visitor.postalCode.trim().toLowerCase().replace(/\s+/g, "")
    )
  }
  if (visitor.country) {
    matching.country = await sha256Hex(visitor.country.trim().toLowerCase())
  }

  if (Object.keys(matching).length === 0) return

  fbq("init", pixelId, matching)
}
