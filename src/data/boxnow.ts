import type { BoxNowLocker, ListBoxNowLockersResult } from "./boxnow-types"

/**
 * BoxNow data layer — browser-visible fetch.
 *
 * Not a server action: we use a plain client fetch with the publishable
 * key so the request appears in the browser Network tab (easier to
 * debug) and caches via Next.js fetch cache on the route segment.
 *
 * Required env in the consuming store:
 *   - NEXT_PUBLIC_MEDUSA_BACKEND_URL
 *   - NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
 */

type ListBoxNowLockersResponse = {
  lockers: BoxNowLocker[]
}

export async function listBoxNowLockers(): Promise<ListBoxNowLockersResult> {
  const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  if (!backendUrl || !publishableKey) {
    return { ok: false, reason: "unconfigured" }
  }

  try {
    const res = await fetch(
      `${backendUrl}/store/integrations/boxnow/lockers`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": publishableKey,
        },
      }
    )

    if (res.status === 503) return { ok: false, reason: "unconfigured" }
    if (res.status === 502) return { ok: false, reason: "upstream" }
    if (!res.ok) return { ok: false, reason: "network" }

    const json = (await res.json()) as ListBoxNowLockersResponse
    const lockers = (json?.lockers ?? []).map((l) => ({
      ...l,
      lat: typeof l.lat === "string" ? parseFloat(l.lat) : l.lat,
      lng: typeof l.lng === "string" ? parseFloat(l.lng) : l.lng,
    }))
    return { ok: true, lockers }
  } catch {
    return { ok: false, reason: "network" }
  }
}
