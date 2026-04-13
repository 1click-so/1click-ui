"use server"

import { sdkFetch } from "./config"

/**
 * BoxNow data layer.
 *
 * Single endpoint today: list all BoxNow lockers for the current store.
 * The backend owns auth to BoxNow's API and returns a flattened shape
 * (see BoxNowLocker). Server-side 10-minute cache lives in the backend;
 * we add a short Next.js cache tag so adjacent requests within a single
 * page render hit the same response.
 */

export type BoxNowLocker = {
  id: string
  title: string
  addressLine1: string
  addressLine2?: string | null
  postalCode: string
  country?: string | null
  lat: number
  lng: number
  note?: string | null
}

type ListBoxNowLockersResponse = {
  lockers: BoxNowLocker[]
}

type ListBoxNowLockersResult =
  | { ok: true; lockers: BoxNowLocker[] }
  | { ok: false; reason: "unconfigured" | "upstream" | "network" }

/**
 * listBoxNowLockers — fetch all configured BoxNow lockers.
 *
 * Returns a discriminated union so the UI can render a precise error
 * state (unconfigured vs. upstream down vs. transport failure) without
 * parsing exception messages. Empty list is returned as `{ ok: true,
 * lockers: [] }`.
 */
export async function listBoxNowLockers(): Promise<ListBoxNowLockersResult> {
  try {
    const res = await sdkFetch<ListBoxNowLockersResponse>(
      "/store/integrations/boxnow/lockers",
      {
        method: "GET",
        next: { tags: ["boxnow-lockers"], revalidate: 600 },
      }
    )
    return { ok: true, lockers: res?.lockers ?? [] }
  } catch (err) {
    const status = (err as { status?: number } | null)?.status
    if (status === 503) return { ok: false, reason: "unconfigured" }
    if (status === 502) return { ok: false, reason: "upstream" }
    return { ok: false, reason: "network" }
  }
}
