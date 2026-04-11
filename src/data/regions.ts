"use server"

import type { HttpTypes } from "@medusajs/types"

import medusaError from "../lib/medusa-error"
import { sdk, sdkFetch } from "./config"
import { getCacheOptions } from "./cookies"

/**
 * Region fetching — cached list, retrieve by id, and country-code lookup.
 *
 * Extracted from mindpages-storefront src/lib/data/regions.ts. The
 * `regionMap` module-level cache is intentional — it speeds up the common
 * case (same countryCode requested repeatedly in one render) without an
 * extra network round-trip. It resets on server restart; that's fine.
 */

export const listRegions = async () => {
  const next = { ...(await getCacheOptions("regions")) }

  return sdkFetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ regions }) => regions)
    .catch(medusaError)
}

export const retrieveRegion = async (id: string) => {
  const next = { ...(await getCacheOptions(["regions", id].join("-"))) }

  return sdkFetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ region }) => region)
    .catch(medusaError)
}

const regionMap = new Map<string, HttpTypes.StoreRegion>()

export const getRegion = async (
  countryCode: string
): Promise<HttpTypes.StoreRegion | null | undefined> => {
  try {
    if (regionMap.has(countryCode)) {
      return regionMap.get(countryCode)
    }

    const regions = await listRegions()
    if (!regions) return null

    regions.forEach((region) => {
      region.countries?.forEach((c) => {
        regionMap.set(c?.iso_2 ?? "", region)
      })
    })

    const region = countryCode
      ? regionMap.get(countryCode)
      : regionMap.get("us")

    return region
  } catch {
    return null
  }
}
