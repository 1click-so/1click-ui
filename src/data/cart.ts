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
  removeCartId,
  setCartId,
} from "./cookies"
import { getLocale } from "./locale-actions"
import { getRegion } from "./regions"
import { getTrackingAttribution } from "../tracking/get-tracking-attribution"
import type { TrackingClientHints } from "../tracking/types"

/**
 * Cart operations — retrieve, create, update, line items, shipping,
 * payment, promotions, address, place order, region switch.
 *
 * Extracted from mindpages-storefront src/lib/data/cart.ts. The legacy
 * applyGiftCard / removeDiscount / removeGiftCard stubs (empty bodies)
 * were dropped during extraction — they were dead code. The form-data
 * `setAddresses` variant kept alongside the POJO `setCartAddresses` so
 * existing callers keep working.
 */

/**
 * Retrieves a cart by its ID. If no ID is provided, it will use the cart ID
 * from the cookies.
 */
export async function retrieveCart(
  cartId?: string,
  fields?: string
): Promise<HttpTypes.StoreCart | null> {
  const id = cartId || (await getCartId())
  fields ??=
    "*items, *region, *items.product, *items.variant, *items.thumbnail, *items.metadata, +items.total, *promotions, +shipping_methods.name"

  if (!id) return null

  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("carts")) }

  return await sdkFetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
      method: "GET",
      query: { fields },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ cart }: { cart: HttpTypes.StoreCart }) => cart)
    .catch(() => null)
}

export async function getOrSetCart(
  countryCode: string
): Promise<HttpTypes.StoreCart> {
  const region = await getRegion(countryCode)
  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  let cart = await retrieveCart(undefined, "id,region_id")
  const headers = { ...(await getAuthHeaders()) }

  if (!cart) {
    const locale = await getLocale()
    const cartResp = await sdk.store.cart.create(
      { region_id: region.id, locale: locale || undefined },
      {},
      headers
    )
    cart = cartResp.cart

    await setCartId(cart.id)

    const cartCacheTag = await getCacheTag("carts")
    updateTag(cartCacheTag)
  }

  if (cart && cart?.region_id !== region.id) {
    await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, headers)
    const cartCacheTag = await getCacheTag("carts")
    updateTag(cartCacheTag)
  }

  return cart
}

export async function updateCart(
  data: HttpTypes.StoreUpdateCart
): Promise<HttpTypes.StoreCart> {
  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("No existing cart found, please create one before updating")
  }

  const headers = { ...(await getAuthHeaders()) }

  return sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }: { cart: HttpTypes.StoreCart }) => {
      const cartCacheTag = await getCacheTag("carts")
      updateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      updateTag(fulfillmentCacheTag)

      return cart
    })
    .catch(medusaError)
}

export async function addToCart({
  variantId,
  quantity,
  countryCode,
}: {
  variantId: string
  quantity: number
  countryCode: string
}): Promise<void> {
  if (!variantId) {
    throw new Error("Missing variant ID when adding to cart")
  }

  const cart = await getOrSetCart(countryCode)
  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  const headers = { ...(await getAuthHeaders()) }

  await sdk.store.cart
    .createLineItem(cart.id, { variant_id: variantId, quantity }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      updateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      updateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function updateLineItem({
  lineId,
  quantity,
}: {
  lineId: string
  quantity: number
}): Promise<void> {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating line item")
  }

  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("Missing cart ID when updating line item")
  }

  const headers = { ...(await getAuthHeaders()) }

  await sdk.store.cart
    .updateLineItem(cartId, lineId, { quantity }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      updateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      updateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function deleteLineItem(lineId: string): Promise<void> {
  if (!lineId) {
    throw new Error("Missing lineItem ID when deleting line item")
  }

  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("Missing cart ID when deleting line item")
  }

  const headers = { ...(await getAuthHeaders()) }

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      updateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      updateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function setShippingMethod({
  cartId,
  shippingMethodId,
}: {
  cartId: string
  shippingMethodId: string
}): Promise<void> {
  const headers = { ...(await getAuthHeaders()) }

  return sdk.store.cart
    .addShippingMethod(cartId, { option_id: shippingMethodId }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      updateTag(cartCacheTag)
    })
    .catch(medusaError)
}

export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  data: HttpTypes.StoreInitializePaymentSession
) {
  const headers = { ...(await getAuthHeaders()) }

  return sdk.store.payment
    .initiatePaymentSession(cart, data, {}, headers)
    .then(async (resp) => {
      const cartCacheTag = await getCacheTag("carts")
      updateTag(cartCacheTag)
      return resp
    })
    .catch(medusaError)
}

export async function applyPromotions(codes: string[]): Promise<void> {
  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("No existing cart found")
  }

  const headers = { ...(await getAuthHeaders()) }

  return sdk.store.cart
    .update(cartId, { promo_codes: codes }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      updateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      updateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function submitPromotionForm(
  _currentState: unknown,
  formData: FormData
): Promise<string | undefined> {
  const code = formData.get("code") as string
  try {
    await applyPromotions([code])
    return undefined
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e)
  }
}

/**
 * Sets shipping + billing addresses on the cart without redirecting.
 * Used by the single-page checkout. Returns null on success, error message
 * on failure.
 */
export async function setCartAddresses(
  _currentState: unknown,
  formData: FormData
): Promise<string | null> {
  try {
    if (!formData) {
      throw new Error("No form data found when setting addresses")
    }
    const cartId = await getCartId()
    if (!cartId) {
      throw new Error("No existing cart found when setting addresses")
    }

    const data: HttpTypes.StoreUpdateCart & { billing_address?: unknown } = {
      shipping_address: {
        first_name: formData.get("shipping_address.first_name") as string,
        last_name: formData.get("shipping_address.last_name") as string,
        address_1: formData.get("shipping_address.address_1") as string,
        address_2: "",
        company: formData.get("shipping_address.company") as string,
        postal_code: formData.get("shipping_address.postal_code") as string,
        city: formData.get("shipping_address.city") as string,
        country_code: formData.get("shipping_address.country_code") as string,
        province: formData.get("shipping_address.province") as string,
        phone: formData.get("shipping_address.phone") as string,
      },
      email: formData.get("email") as string,
    }

    const sameAsBilling = formData.get("same_as_billing")
    if (sameAsBilling === "on") data.billing_address = data.shipping_address

    if (sameAsBilling !== "on") {
      data.billing_address = {
        first_name: formData.get("billing_address.first_name") as string,
        last_name: formData.get("billing_address.last_name") as string,
        address_1: formData.get("billing_address.address_1") as string,
        address_2: "",
        company: formData.get("billing_address.company") as string,
        postal_code: formData.get("billing_address.postal_code") as string,
        city: formData.get("billing_address.city") as string,
        country_code: formData.get("billing_address.country_code") as string,
        province: formData.get("billing_address.province") as string,
        phone: formData.get("billing_address.phone") as string,
      }
    }

    await updateCart(data)
    return null
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e)
  }
}

/**
 * Legacy address-save action — redirects to checkout?step=delivery after
 * save. Used by the Medusa starter's multi-step checkout flow. Kept for
 * callers still relying on the redirect behavior.
 */
export async function setAddresses(
  _currentState: unknown,
  formData: FormData
): Promise<string | undefined> {
  let countryCode: string
  try {
    if (!formData) {
      throw new Error("No form data found when setting addresses")
    }
    const cartId = await getCartId()
    if (!cartId) {
      throw new Error("No existing cart found when setting addresses")
    }

    const data: HttpTypes.StoreUpdateCart & { billing_address?: unknown } = {
      shipping_address: {
        first_name: formData.get("shipping_address.first_name") as string,
        last_name: formData.get("shipping_address.last_name") as string,
        address_1: formData.get("shipping_address.address_1") as string,
        address_2: "",
        company: formData.get("shipping_address.company") as string,
        postal_code: formData.get("shipping_address.postal_code") as string,
        city: formData.get("shipping_address.city") as string,
        country_code: formData.get("shipping_address.country_code") as string,
        province: formData.get("shipping_address.province") as string,
        phone: formData.get("shipping_address.phone") as string,
      },
      email: formData.get("email") as string,
    }

    countryCode = formData.get("shipping_address.country_code") as string

    const sameAsBilling = formData.get("same_as_billing")
    if (sameAsBilling === "on") data.billing_address = data.shipping_address

    if (sameAsBilling !== "on") {
      data.billing_address = {
        first_name: formData.get("billing_address.first_name") as string,
        last_name: formData.get("billing_address.last_name") as string,
        address_1: formData.get("billing_address.address_1") as string,
        address_2: "",
        company: formData.get("billing_address.company") as string,
        postal_code: formData.get("billing_address.postal_code") as string,
        city: formData.get("billing_address.city") as string,
        country_code: formData.get("billing_address.country_code") as string,
        province: formData.get("billing_address.province") as string,
        phone: formData.get("billing_address.phone") as string,
      }
    }
    await updateCart(data)
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e)
  }

  redirect(`/${countryCode}/checkout?step=delivery`)
}

/**
 * Places an order for a cart. If no cart ID is provided, uses the cart ID
 * from cookies. On success, redirects to the order confirmation page.
 *
 * `clientHints` is optional browser-only attribution data the server
 * cannot read from cookies/headers (currently `engagementTimeMsec`).
 * Storefronts pass it from a client component before triggering this
 * server action — without it, ga_engagement_time_msec falls back to the
 * backend's default of 100ms.
 */
export async function placeOrder(
  cartId?: string,
  clientHints?: TrackingClientHints
): Promise<HttpTypes.StoreCart | undefined> {
  const id = cartId || (await getCartId())
  if (!id) {
    throw new Error("No existing cart found when placing an order")
  }

  const headers = { ...(await getAuthHeaders()) }

  // Meta Pixel + CAPI + GA4 Measurement Protocol attribution. Read
  // _fbp/_fbc/_ga/_ga_<MID> cookies, UA, IP, referer from the current
  // request, plus client-supplied engagement time, and persist them on
  // cart metadata. Medusa copies cart.metadata → order.metadata at
  // completion, so the order.placed subscriber (medusa-mindpages) can
  // dedup the Browser-side Meta Purchase against the server-side CAPI
  // Purchase, and forward the canonical GA4 client_id / session_id /
  // engagement_time to the GA4 Measurement Protocol Purchase event.
  //
  // Existing metadata (e.g., boxnow_locker_*, econt_office_*) MUST be
  // preserved — Medusa replaces the metadata field wholesale on update,
  // it does not merge. Fetch fresh metadata uncached and merge.
  //
  // Best-effort: never throws — if no trackers are configured or cookies
  // aren't set, the spread is empty and order completion proceeds normally.
  try {
    const attribution = await getTrackingAttribution(clientHints)
    if (Object.keys(attribution).length > 0) {
      const { cart: freshCart } = await sdkFetch<HttpTypes.StoreCartResponse>(
        `/store/carts/${id}`,
        {
          method: "GET",
          query: { fields: "id,metadata" },
          headers,
          cache: "no-store",
        }
      )
      await sdk.store.cart.update(
        id,
        {
          metadata: {
            ...(freshCart.metadata ?? {}),
            ...(attribution as Record<string, string | number>),
          },
        },
        {},
        headers
      )
    }
  } catch {
    // Attribution writeback is non-critical — never block the order.
  }

  const cartRes = await sdk.store.cart
    .complete(id, {}, headers)
    .then(async (resp) => {
      const cartCacheTag = await getCacheTag("carts")
      updateTag(cartCacheTag)
      return resp
    })
    .catch(medusaError)

  if (cartRes && cartRes.type === "order") {
    const countryCode =
      cartRes.order.shipping_address?.country_code?.toLowerCase()

    const orderCacheTag = await getCacheTag("orders")
    updateTag(orderCacheTag)

    await removeCartId()
    redirect(`/${countryCode}/order/${cartRes.order.id}/confirmed`)
  }

  return cartRes?.cart
}

/**
 * Updates the countrycode param and revalidates the regions cache.
 * Redirects to the same path under the new country code.
 */
export async function updateRegion(
  countryCode: string,
  currentPath: string
): Promise<void> {
  const cartId = await getCartId()
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  if (cartId) {
    await updateCart({ region_id: region.id })
    const cartCacheTag = await getCacheTag("carts")
    updateTag(cartCacheTag)
  }

  const regionCacheTag = await getCacheTag("regions")
  updateTag(regionCacheTag)

  const productsCacheTag = await getCacheTag("products")
  updateTag(productsCacheTag)

  redirect(`/${countryCode}${currentPath}`)
}

export async function listCartOptions() {
  const cartId = await getCartId()
  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("shippingOptions")) }

  return await sdkFetch<{
    shipping_options: HttpTypes.StoreCartShippingOption[]
  }>("/store/shipping-options", {
    query: { cart_id: cartId },
    next,
    headers,
    cache: "force-cache",
  })
}
