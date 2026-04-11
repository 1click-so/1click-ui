"use server"

import type { HttpTypes } from "@medusajs/types"
import { updateTag } from "next/cache"
import { redirect } from "next/navigation"

import medusaError from "../lib/medusa-error"
import { sdk, sdkFetch } from "./config"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeAuthToken,
  removeCartId,
  setAuthToken,
} from "./cookies"

/**
 * Customer operations — retrieve, update, auth (signup/login/logout),
 * address CRUD, cart transfer on login.
 *
 * Extracted from mindpages-storefront src/lib/data/customer.ts.
 */

export const retrieveCustomer = async (): Promise<HttpTypes.StoreCustomer | null> => {
  const authHeaders = await getAuthHeaders()
  if (!authHeaders) return null

  const headers = { ...authHeaders }
  const next = { ...(await getCacheOptions("customers")) }

  return await sdkFetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
      method: "GET",
      query: { fields: "*orders" },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ customer }) => customer)
    .catch(() => null)
}

export const updateCustomer = async (
  body: HttpTypes.StoreUpdateCustomer
): Promise<HttpTypes.StoreCustomer> => {
  const headers = { ...(await getAuthHeaders()) }

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(medusaError)

  const cacheTag = await getCacheTag("customers")
  updateTag(cacheTag)

  return updateRes
}

export async function signup(
  _currentState: unknown,
  formData: FormData
): Promise<HttpTypes.StoreCustomer | string> {
  const password = formData.get("password") as string
  const customerForm = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: formData.get("phone") as string,
  }

  try {
    const token = await sdk.auth.register("customer", "emailpass", {
      email: customerForm.email,
      password,
    })

    await setAuthToken(token as string)

    const headers = { ...(await getAuthHeaders()) }

    const { customer: createdCustomer } = await sdk.store.customer.create(
      customerForm,
      {},
      headers
    )

    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email: customerForm.email,
      password,
    })

    await setAuthToken(loginToken as string)

    const customerCacheTag = await getCacheTag("customers")
    updateTag(customerCacheTag)

    await transferCart()

    return createdCustomer
  } catch (error: unknown) {
    return error instanceof Error ? error.toString() : String(error)
  }
}

export async function login(
  _currentState: unknown,
  formData: FormData
): Promise<string | undefined> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  try {
    await sdk.auth
      .login("customer", "emailpass", { email, password })
      .then(async (token) => {
        await setAuthToken(token as string)
        const customerCacheTag = await getCacheTag("customers")
        updateTag(customerCacheTag)
      })
  } catch (error: unknown) {
    return error instanceof Error ? error.toString() : String(error)
  }

  try {
    await transferCart()
  } catch (error: unknown) {
    return error instanceof Error ? error.toString() : String(error)
  }
  return undefined
}

export async function signout(countryCode: string): Promise<void> {
  await sdk.auth.logout()
  await removeAuthToken()

  const customerCacheTag = await getCacheTag("customers")
  updateTag(customerCacheTag)

  await removeCartId()
  const cartCacheTag = await getCacheTag("carts")
  updateTag(cartCacheTag)

  redirect(`/${countryCode}/account`)
}

export async function transferCart(): Promise<void> {
  const cartId = await getCartId()
  if (!cartId) return

  const headers = await getAuthHeaders()
  await sdk.store.cart.transferCart(cartId, {}, headers)

  const cartCacheTag = await getCacheTag("carts")
  updateTag(cartCacheTag)
}

export const addCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<{ success: boolean; error: string | null }> => {
  const isDefaultBilling = (currentState.isDefaultBilling as boolean) || false
  const isDefaultShipping = (currentState.isDefaultShipping as boolean) || false

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
    is_default_billing: isDefaultBilling,
    is_default_shipping: isDefaultShipping,
  }

  const headers = { ...(await getAuthHeaders()) }

  return sdk.store.customer
    .createAddress(address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      updateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => ({ success: false, error: err.toString() }))
}

export const deleteCustomerAddress = async (
  addressId: string
): Promise<{ success: boolean; error: string | null }> => {
  const headers = { ...(await getAuthHeaders()) }

  return sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      updateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => ({ success: false, error: err.toString() }))
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<{ success: boolean; error: string | null }> => {
  const addressId =
    (currentState.addressId as string) || (formData.get("addressId") as string)

  if (!addressId) {
    return { success: false, error: "Address ID is required" }
  }

  const address: HttpTypes.StoreUpdateCustomerAddress = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
  }

  const phone = formData.get("phone") as string
  if (phone) address.phone = phone

  const headers = { ...(await getAuthHeaders()) }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      updateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => ({ success: false, error: err.toString() }))
}
