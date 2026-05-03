import "server-only"

import type { TrackingConfig, TrackingConfigResponse } from "./types"

/**
 * Server-side fetch of the Medusa backend's public tracking config.
 *
 * Hits `GET {MEDUSA_BACKEND_URL}/store/integrations/tracking`, which
 * returns only non-sensitive IDs (pixelId, containerId, measurementId,
 * publicKey). Access tokens never traverse this surface.
 *
 * Response is cached for 5 minutes (`revalidate: 300`) — these IDs
 * change rarely (admin → Settings → Integrations), and the cache
 * keeps every request from re-hitting the backend.
 *
 * Returns an empty config on any error so storefront layouts can
 * always call this and just render nothing if there's no pixel.
 */
export async function getTrackingConfig(): Promise<TrackingConfig> {
  const baseUrl =
    process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  if (!publishableKey) return {}

  // Native `fetch` RequestInit doesn't type Next.js's `next` extension —
  // the library tsconfig doesn't pull in Next's ambient types. Cast to
  // a local type so the call site stays correctly typed.
  type NextFetchInit = RequestInit & {
    next?: { revalidate?: number | false; tags?: string[] }
  }

  try {
    const init: NextFetchInit = {
      headers: {
        "x-publishable-api-key": publishableKey,
      },
      next: { revalidate: 300, tags: ["tracking-config"] },
    }

    const res = await fetch(
      `${baseUrl}/store/integrations/tracking`,
      init as RequestInit
    )

    if (!res.ok) return {}

    const data = (await res.json()) as TrackingConfigResponse
    return data.tracking ?? {}
  } catch {
    return {}
  }
}
