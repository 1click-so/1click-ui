"use server"

import type { HttpTypes } from "@medusajs/types"

import { sdk, sdkFetch } from "./config"
import { getAuthHeaders, getCacheOptions } from "./cookies"

/**
 * Shipping-option operations — list options for a cart, calculate a price
 * for a specific option (used for rate-shopping calculated carriers).
 *
 * Extracted from mindpages-storefront src/lib/data/fulfillment.ts.
 */

export const listCartShippingMethods = async (
  cartId: string
): Promise<HttpTypes.StoreCartShippingOption[] | null> => {
  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("fulfillment")) }

  return sdkFetch<HttpTypes.StoreShippingOptionListResponse>(`/store/shipping-options`, {
      method: "GET",
      query: { cart_id: cartId },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ shipping_options }) => shipping_options)
    .catch(() => null)
}

export const calculatePriceForShippingOption = async (
  optionId: string,
  cartId: string,
  data?: Record<string, unknown>
): Promise<HttpTypes.StoreCartShippingOption | null> => {
  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("fulfillment")) }

  const body: { cart_id: string; data?: Record<string, unknown> } = { cart_id: cartId }
  if (data) body.data = data

  return sdkFetch<{ shipping_option: HttpTypes.StoreCartShippingOption }>(
      `/store/shipping-options/${optionId}/calculate`,
      { method: "POST", body, headers, next }
    )
    .then(({ shipping_option }) => shipping_option)
    .catch(() => null)
}
