import type { ListPigeonOfficesResult, PigeonOffice } from "./pigeon-types"

/**
 * Pigeon Express data layer — browser-visible fetch.
 *
 * Mirrors data/boxnow.ts: a plain client fetch with the publishable key
 * so the request shows in the browser Network tab and rides Next.js
 * fetch caching. The backend owns the carrier credentials and a
 * 10-minute office-list cache.
 *
 * Required env in the consuming store:
 *   - NEXT_PUBLIC_MEDUSA_BACKEND_URL
 *   - NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
 */

type ListPigeonOfficesResponse = {
  offices: PigeonOffice[]
}

export async function listPigeonOffices(): Promise<ListPigeonOfficesResult> {
  const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  if (!backendUrl || !publishableKey) {
    return { ok: false, reason: "unconfigured" }
  }

  try {
    const res = await fetch(`${backendUrl}/store/integrations/pigeon/offices`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": publishableKey,
      },
    })

    if (res.status === 503) return { ok: false, reason: "unconfigured" }
    if (res.status === 502) return { ok: false, reason: "upstream" }
    if (!res.ok) return { ok: false, reason: "network" }

    const json = (await res.json()) as ListPigeonOfficesResponse
    return { ok: true, offices: json?.offices ?? [] }
  } catch {
    return { ok: false, reason: "network" }
  }
}
