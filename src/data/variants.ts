"use server"

import type { HttpTypes } from "@medusajs/types"

import { sdk, sdkFetch } from "./config"
import { getAuthHeaders, getCacheOptions } from "./cookies"

/**
 * Variant retrieval by ID.
 *
 * Extracted from mindpages-storefront src/lib/data/variants.ts.
 */

export const retrieveVariant = async (
  variant_id: string
): Promise<HttpTypes.StoreProductVariant | null> => {
  const authHeaders = await getAuthHeaders()
  if (!authHeaders) return null

  const headers = { ...authHeaders }
  const next = { ...(await getCacheOptions("variants")) }

  return await sdkFetch<{ variant: HttpTypes.StoreProductVariant }>(
      `/store/product-variants/${variant_id}`,
      {
        method: "GET",
        query: { fields: "*images" },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ variant }) => variant)
    .catch(() => null)
}
