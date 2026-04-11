"use server"

import type { HttpTypes } from "@medusajs/types"

import medusaError from "../lib/medusa-error"
import { sdk, sdkFetch } from "./config"
import { getAuthHeaders, getCacheOptions } from "./cookies"

/**
 * Order operations — retrieve, list, transfer (request/accept/decline).
 *
 * Extracted from mindpages-storefront src/lib/data/orders.ts.
 */

export const retrieveOrder = async (id: string): Promise<HttpTypes.StoreOrder> => {
  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("orders")) }

  return sdkFetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
      method: "GET",
      query: {
        fields:
          "+metadata,*payment_collections.payments,*items,*items.metadata,*items.variant,*items.product",
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ order }) => order)
    .catch((err) => medusaError(err))
}

export const listOrders = async (
  limit: number = 10,
  offset: number = 0,
  filters?: Record<string, unknown>
): Promise<HttpTypes.StoreOrder[]> => {
  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("orders")) }

  return sdkFetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      method: "GET",
      query: {
        limit,
        offset,
        order: "-created_at",
        fields: "*items,+items.metadata,*items.variant,*items.product",
        ...filters,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ orders }) => orders)
    .catch((err) => medusaError(err))
}

type TransferResult = {
  success: boolean
  error: string | null
  order: HttpTypes.StoreOrder | null
}

export const createTransferRequest = async (
  _state: TransferResult,
  formData: FormData
): Promise<TransferResult> => {
  const id = formData.get("order_id") as string
  if (!id) {
    return { success: false, error: "Order ID is required", order: null }
  }

  const headers = await getAuthHeaders()

  return await sdk.store.order
    .requestTransfer(id, {}, { fields: "id, email" }, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export const acceptTransferRequest = async (
  id: string,
  token: string
): Promise<TransferResult> => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .acceptTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export const declineTransferRequest = async (
  id: string,
  token: string
): Promise<TransferResult> => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .declineTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}
