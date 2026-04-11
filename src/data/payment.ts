"use server"

import type { HttpTypes } from "@medusajs/types"

import { sdk, sdkFetch } from "./config"
import { getAuthHeaders, getCacheOptions } from "./cookies"

/**
 * Payment provider listing for a region. Used by checkout to render the
 * list of available payment methods (card, COD, etc.) per region.
 *
 * Extracted from mindpages-storefront src/lib/data/payment.ts.
 */

export const listCartPaymentMethods = async (
  regionId: string
): Promise<HttpTypes.StorePaymentProvider[] | null> => {
  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("payment_providers")) }

  return sdkFetch<HttpTypes.StorePaymentProviderListResponse>(`/store/payment-providers`, {
      method: "GET",
      query: { region_id: regionId },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ payment_providers }) =>
      [...payment_providers].sort((a, b) => (a.id > b.id ? 1 : -1))
    )
    .catch(() => null)
}
