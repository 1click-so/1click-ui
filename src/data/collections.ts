"use server"

import type { HttpTypes } from "@medusajs/types"

import { sdkFetch } from "./config"
import { getCacheOptions } from "./cookies"

/**
 * Collection operations — retrieve, list, get by handle.
 *
 * Extracted from mindpages-storefront src/lib/data/collections.ts.
 */

export const retrieveCollection = async (id: string) => {
  const next = { ...(await getCacheOptions("collections")) }

  return sdkFetch<{ collection: HttpTypes.StoreCollection }>(
      `/store/collections/${id}`,
      { next, cache: "force-cache" }
    )
    .then(({ collection }) => collection)
}

export const listCollections = async (
  queryParams: Record<string, string> = {}
): Promise<{ collections: HttpTypes.StoreCollection[]; count: number }> => {
  const next = { ...(await getCacheOptions("collections")) }

  queryParams.limit = queryParams.limit || "100"
  queryParams.offset = queryParams.offset || "0"

  return sdkFetch<{ collections: HttpTypes.StoreCollection[]; count: number }>(
      "/store/collections",
      { query: queryParams, next, cache: "force-cache" }
    )
    .then(({ collections }) => ({ collections, count: collections.length }))
}

export const getCollectionByHandle = async (
  handle: string
): Promise<HttpTypes.StoreCollection | undefined> => {
  const next = { ...(await getCacheOptions("collections")) }

  return sdkFetch<HttpTypes.StoreCollectionListResponse>(`/store/collections`, {
      query: { handle, fields: "*products" },
      next,
      cache: "force-cache",
    })
    .then(({ collections }) => collections[0])
}
