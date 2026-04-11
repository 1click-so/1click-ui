"use server"

import type { HttpTypes } from "@medusajs/types"

import { sdk, sdkFetch } from "./config"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"

/**
 * Product fetching — by handle, paginated list.
 *
 * Extracted from mindpages-storefront src/lib/data/products.ts. The
 * `listProductsWithSort` convenience wrapper was dropped — it depended on
 * a store-specific `SortOptions` type from a UI refinement list. Stores
 * that want sorted product lists can pass `order` in `queryParams` directly
 * (it's a Medusa-supported query param) or sort client-side after fetch.
 */

export async function getProductByHandle(
  handle: string,
  countryCode: string
): Promise<HttpTypes.StoreProduct | null> {
  const region = await getRegion(countryCode)
  if (!region) return null

  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("products")) }

  return sdkFetch<{ products: HttpTypes.StoreProduct[] }>(`/store/products`, {
      method: "GET",
      query: {
        handle,
        region_id: region.id,
        fields:
          "*variants.calculated_price,+variants.inventory_quantity,*images,+metadata",
        limit: 1,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ products }) => products[0] || null)
    .catch(() => null)
}

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("products")) }

  return sdkFetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields:
            "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,",
          ...queryParams,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null
      return {
        response: { products, count },
        nextPage,
        queryParams,
      }
    })
}
