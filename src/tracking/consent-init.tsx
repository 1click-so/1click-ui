import { CONSENT_COOKIE } from "./consent"

/**
 * ConsentInit — the synchronous Consent Mode v2 "default" snippet.
 *
 * Render it as the FIRST child of <body> (App Router layouts don't
 * expose <head> for inline scripts). A plain inline <script>
 * (deliberately NOT next/script) executes at HTML-parse time — long
 * before the afterInteractive <GA4>/<MetaPixel> loaders, which run
 * post-hydration. Google's consent-mode docs require the default to be
 * set synchronously ahead of the tag; an async default races the
 * loader and the first hit of a returning consented visitor would
 * ship denied.
 *
 * Behavior:
 *   - No stored choice (first visit) → default ALL DENIED. Tags still
 *     load (advanced consent mode): gtag sends cookieless pings, the
 *     Pixel queues client-side. The <ConsentBanner> then collects the
 *     choice and applies the live 'update'.
 *   - Stored choice → default mirrors it, so returning visitors are
 *     correct from the very first hit with no banner and no race.
 *
 * `ads_data_redaction` strips ad-click identifiers (gclid et al.) from
 * the cookieless pings while ad_storage is denied, per Google's docs.
 *
 * The script is static (no props interpolated beyond the shared cookie
 * name) — safe as a server-component inline script with a stable id.
 */
export function ConsentInit() {
  const snippet = `
(function(){
  var c=null;
  try{
    var m=document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=([^;]*)/);
    if(m){c=JSON.parse(decodeURIComponent(m[1]));}
  }catch(e){}
  var ads=!!(c&&c.ads), an=!!(c&&c.analytics);
  window.dataLayer=window.dataLayer||[];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent','default',{
    'ad_storage':ads?'granted':'denied',
    'ad_user_data':ads?'granted':'denied',
    'ad_personalization':ads?'granted':'denied',
    'analytics_storage':an?'granted':'denied'
  });
  gtag('set','ads_data_redaction',!ads);
})();
`.trim()

  return (
    <script
      id="1click-consent-init"
      dangerouslySetInnerHTML={{ __html: snippet }}
    />
  )
}
