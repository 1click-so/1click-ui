"use client"

import Script from "next/script"

/**
 * MetaPixel — client-side base pixel injector.
 *
 * Loads `https://connect.facebook.net/en_US/fbevents.js` via Next.js
 * `<Script strategy="afterInteractive">` (the canonical strategy for
 * third-party tags per Next.js docs). Initializes `fbq` with the given
 * pixel ID and fires an initial `PageView`.
 *
 * Renders nothing when `pixelId` is falsy — every consuming layout
 * can call this unconditionally; the script is only injected when the
 * admin has configured Facebook Pixel + CAPI.
 *
 * Subsequent route navigations DON'T need a manual PageView — the
 * single base init covers the initial page; further events are fired
 * explicitly via the helpers in `./fbq.ts`.
 */
export function MetaPixel({ pixelId }: { pixelId?: string }) {
  if (!pixelId) return null

  const initSnippet = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
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
