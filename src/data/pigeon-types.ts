/**
 * Pigeon Express types shared between the data layer and the checkout
 * office selector. Mirrors boxnow-types.ts.
 *
 * The office list comes from our backend's
 * GET /store/integrations/pigeon/offices (medusa-mindpages), which
 * proxies Pigeon's credentialed /v1/offices API — unlike Econt, whose
 * nomenclature endpoint is public, Pigeon requires the store's API key,
 * so the browser can never call the carrier directly.
 */

export type PigeonOffice = {
  /** Pigeon's numeric catalogue id — what the waybill needs. */
  id: number
  name: string
  city: string
  /** Pigeon city catalogue id, forwarded so the waybill can skip a city lookup. */
  city_id: number | null
  address: string
  postal_code: string
  lat: number | null
  lng: number | null
}

export type ListPigeonOfficesResult =
  | { ok: true; offices: PigeonOffice[] }
  | { ok: false; reason: "unconfigured" | "upstream" | "network" }
