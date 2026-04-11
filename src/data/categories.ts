import type { HttpTypes } from "@medusajs/types"

import { sdk, sdkFetch } from "./config"
import { getCacheOptions } from "./cookies"

/**
 * Product category fetching — list + get by handle.
 *
 * Extracted from mindpages-storefront src/lib/data/categories.ts. Not a
 * server action (no "use server" directive) — callable from any context
 * where the SDK is available.
 */

export const listCategories = async (query?: Record<string, unknown>) => {
  const next = { ...(await getCacheOptions("categories")) }
  const limit = (query?.limit as number | undefined) || 100

  return sdkFetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = categoryHandle.join("/")
  const next = { ...(await getCacheOptions("categories")) }

  return sdkFetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products",
          handle,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories[0])
}
