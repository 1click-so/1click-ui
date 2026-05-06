"use server"

import type { HttpTypes } from "@medusajs/types"
import { refresh, updateTag } from "next/cache"
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
 *
 * `noCache` bypasses Next.js's data cache for the read. Use after a
 * mutation (e.g. initiatePaymentSession rotates the Stripe session) when
 * the calling code MUST observe the fresh server state within the same
 * request — the standard updateTag invalidation only guarantees freshness
 * for the NEXT request, not the current one.
 */
export async function retrieveCart(
  cartId?: string,
  fields?: string,
  noCache?: boolean
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
      next: noCache ? undefined : next,
      cache: noCache ? "no-store" : "force-cache",
    })
    .then(({ cart }: { cart: HttpTypes.StoreCart }) => cart)
    .catch(async (err: unknown) => {
      // Previously this was `.catch(() => null)` — every retrieve
      // failure (404, network, auth, region mismatch, 500) was
      // indistinguishable from "no cart yet". Callers would treat as
      // empty and CREATE a new cart, abandoning the real one silently.
      // Now: log every failure with status + path so ops can see when
      // the backend is degraded vs. when there's just no cookie.
      const status = (err as { status?: number })?.status
      await logEvent({
        errorType: "cart_retrieve_failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        surface: "system",
        severity: status && status >= 500 ? "critical" : "medium",
        cartId: id,
        context: {
          http_status: status,
          fields_summary: fields?.slice(0, 200),
          no_cache: !!noCache,
        },
      })
      return null
    })
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

      // Trigger client router refresh so server components re-render
      // with the updated cart. updateTag alone only invalidates the
      // cache for the NEXT request — without refresh(), the current
      // page keeps the stale cart prop and the UI looks frozen
      // (the symptom: removed item stays grayed-out, payment session
      // changes don't propagate to PaymentWrapper, etc).
      // Verified via Next.js 16 docs: refresh() from next/cache is
      // server-action-only and is the canonical post-mutation primitive.
      // https://nextjs.org/docs/app/api-reference/functions/refresh
      refresh()

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
    void logEvent({
      errorType: "cart_add_failed",
      errorMessage: "Missing variant ID when adding to cart",
      surface: "cart_drawer",
      severity: "high",
      context: { country_code: countryCode, quantity, reason: "missing_variant_id" },
    })
    throw new Error("Missing variant ID when adding to cart")
  }

  let cart: HttpTypes.StoreCart
  try {
    cart = await getOrSetCart(countryCode)
  } catch (err: unknown) {
    void logEvent({
      errorType: "cart_create_failed",
      errorMessage: err instanceof Error ? err.message : String(err),
      surface: "cart_drawer",
      severity: "critical",
      variantId,
      context: { country_code: countryCode, quantity, step: "get_or_set_cart" },
    })
    throw err
  }
  if (!cart) {
    void logEvent({
      errorType: "cart_add_failed",
      errorMessage: "Error retrieving or creating cart",
      surface: "cart_drawer",
      severity: "critical",
      variantId,
      context: { country_code: countryCode, quantity, reason: "no_cart" },
    })
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

      refresh()
    })
    .catch(async (err: unknown) => {
      await logEvent({
        errorType: "cart_add_failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        surface: "cart_drawer",
        severity: "critical",
        cartId: cart.id,
        variantId,
        context: {
          country_code: countryCode,
          region_id: cart.region_id,
          quantity,
          err_status: (err as { status?: number })?.status,
        },
      })
      return medusaError(err as Parameters<typeof medusaError>[0])
    })
}

export async function updateLineItem({
  lineId,
  quantity,
}: {
  lineId: string
  quantity: number
}): Promise<void> {
  if (!lineId) {
    void logEvent({
      errorType: "cart_line_update_failed",
      errorMessage: "Missing lineItem ID when updating line item",
      surface: "cart_drawer",
      severity: "high",
      context: { quantity, reason: "missing_line_id" },
    })
    throw new Error("Missing lineItem ID when updating line item")
  }

  const cartId = await getCartId()
  if (!cartId) {
    void logEvent({
      errorType: "cart_line_update_failed",
      errorMessage: "Missing cart ID when updating line item",
      surface: "cart_drawer",
      severity: "high",
      context: { line_id: lineId, quantity, reason: "no_cart" },
    })
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

      refresh()
    })
    .catch(async (err: unknown) => {
      await logEvent({
        errorType: "cart_line_update_failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        surface: "cart_drawer",
        severity: "high",
        cartId,
        context: {
          line_id: lineId,
          attempted_quantity: quantity,
          err_status: (err as { status?: number })?.status,
        },
      })
      return medusaError(err as Parameters<typeof medusaError>[0])
    })
}

export async function deleteLineItem(lineId: string): Promise<void> {
  if (!lineId) {
    void logEvent({
      errorType: "cart_line_delete_failed",
      errorMessage: "Missing lineItem ID when deleting line item",
      surface: "cart_drawer",
      severity: "high",
      context: { reason: "missing_line_id" },
    })
    throw new Error("Missing lineItem ID when deleting line item")
  }

  const cartId = await getCartId()
  if (!cartId) {
    void logEvent({
      errorType: "cart_line_delete_failed",
      errorMessage: "Missing cart ID when deleting line item",
      surface: "cart_drawer",
      severity: "high",
      context: { line_id: lineId, reason: "no_cart" },
    })
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

      refresh()
    })
    .catch(async (err: unknown) => {
      await logEvent({
        errorType: "cart_line_delete_failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        surface: "cart_drawer",
        severity: "high",
        cartId,
        context: {
          line_id: lineId,
          err_status: (err as { status?: number })?.status,
        },
      })
      return medusaError(err as Parameters<typeof medusaError>[0])
    })
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
      refresh()
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
      // Critical: without refresh() here the React-side cart prop
      // keeps the OLD payment_session (with the now-canceled PI's
      // client_secret) and Stripe Elements stays stuck on it. This is
      // exactly the "PaymentIntent in terminal state" symptom.
      refresh()
      return resp
    })
    .catch(medusaError)
}

/**
 * Asks the backend to validate the cart's Stripe PaymentIntent against
 * Stripe's actual lifecycle and rotate the session if the PI is in a
 * terminal state (canceled / succeeded / requires_capture).
 *
 * Backend: POST /store/carts/:id/refresh-payment-if-terminal
 * (medusa-mindpages, src/api/store/carts/[id]/refresh-payment-if-terminal/route.ts)
 *
 * Why this exists: Medusa's payment_session.status drifts from Stripe's
 * PI status — Medusa core's webhook subscriber explicitly drops
 * `payment_intent.canceled` / `payment_intent.payment_failed` events
 * (see node_modules/@medusajs/medusa/dist/subscribers/payment-webhook.js
 * lines 17-23). The session record stays "pending" while the PI is
 * dead. Mounting Elements on the dead client_secret fails with
 * "PaymentIntent is in a terminal state".
 *
 * The storefront should call this in two places:
 *   1. Server-side on checkout page mount (catches the common case of
 *      a returning user with an aged cart cookie + canceled PI)
 *   2. Client-side on Stripe Elements `loaderror` (defense-in-depth)
 *
 * Returns `{ rotated: boolean, reason: string }`. Caller should re-fetch
 * the cart when `rotated === true` to pick up the fresh client_secret.
 *
 * Best-effort: never throws — a failed reconciliation should not block
 * the page from rendering.
 */
/**
 * Asks the backend to sync the cart's pending Stripe payment session
 * to the cart's current total WITHOUT rotating the session when
 * possible. Use this after any cart mutation that changes the total
 * (shipping method, discount, address change that affects tax) — the
 * happy path returns the SAME `client_secret`, so storefront
 * `<Elements>` doesn't unmount + remount.
 *
 * Backend: POST /store/carts/:id/sync-payment-amount
 * (medusa-mindpages, src/api/store/carts/[id]/sync-payment-amount/route.ts)
 *
 * Behaviour:
 *   - Same provider + amount unchanged       → no-op, returns same secret
 *   - Same provider + amount changed         → in-place update via
 *       stripe.paymentIntents.update; client_secret unchanged
 *   - Provider mismatch OR Stripe rejects    → falls back to
 *       createPaymentSessionsWorkflow (rotation); new client_secret
 *
 * The backend route always returns successfully on the happy path —
 * no need to wrap in try/catch for normal use. Network errors throw.
 *
 * Why this is preferred over `initiatePaymentSession` after shipping
 * changes: `initiatePaymentSession` always rotates (Medusa's
 * createPaymentSessionsWorkflow always deletes + creates), which
 * forces `<Elements>` to remount and triggers cascading effects
 * (tracking refires, refs reset, Stripe iframe reload). Calling
 * `syncPaymentAmount` instead keeps the session alive when only the
 * amount changed, so none of that happens.
 */
export async function syncPaymentAmount(
  cartId: string,
  providerId?: string
): Promise<{
  synced: boolean
  rotated?: boolean
  client_secret?: string
  provider_id?: string
  reason?: string
}> {
  const headers = { ...(await getAuthHeaders()) }

  try {
    const resp = await sdkFetch<{
      synced: boolean
      rotated?: boolean
      client_secret?: string
      provider_id?: string
      reason?: string
    }>(`/store/carts/${cartId}/sync-payment-amount`, {
      method: "POST",
      headers,
      body: providerId ? { provider_id: providerId } : {},
      cache: "no-store",
    })

    if (resp.rotated) {
      // Rotation produced a new client_secret — bust the cart cache
      // and refresh so the storefront re-renders with it. Skipping
      // refresh on the in-place update path is intentional: the
      // client_secret is unchanged, so the storefront's existing
      // <Elements> mount keeps working with no UI churn.
      const cartCacheTag = await getCacheTag("carts")
      updateTag(cartCacheTag)
      refresh()
    }
    return resp
  } catch {
    // Network blip / backend down — return a synthetic "not synced"
    // result so the caller can decide what to do (typically: fall
    // back to initiatePaymentSession to recreate from scratch).
    return { synced: false, reason: "request-failed" }
  }
}

/**
 * Prepares a cart for completion by writing all deferred state in one
 * atomic backend call:
 *   - shipping address + billing address
 *   - shipping method
 *   - carrier metadata (econt_office_*, boxnow_locker_*)
 *   - COD-fee line item (if COD provider) — added/removed via shared
 *     utility used by the existing payment-sessions middleware
 *   - payment session (Stripe deferred-intent PaymentIntent OR COD intent)
 *
 * Backend: POST /store/carts/:id/prepare-checkout
 * (medusa-mindpages, src/api/store/carts/[id]/prepare-checkout/route.ts)
 *
 * After this returns, the storefront:
 *   - Card path: calls `stripe.confirmPayment({ elements, clientSecret })`,
 *     then `placeOrder()` (Medusa's standard /complete endpoint).
 *   - COD path: calls `placeOrder()` directly.
 *
 * Why split from completeCart: Medusa's `authorizePaymentSessionStep`
 * throws when the Stripe PaymentIntent is in `requires_payment_method`
 * (the deferred-intent default). The storefront must call
 * `stripe.confirmPayment` between this prepare call and `complete` so
 * the PI transitions to `requires_capture` (manual capture) or
 * `succeeded` (auto-capture) — both pass the authorize check.
 *
 * Returns the freshly-created session's `client_secret` (null for COD)
 * so the storefront can immediately hand it to `stripe.confirmPayment`.
 */
export async function prepareCheckout(
  cartId: string,
  payload: {
    shipping_address: {
      first_name: string
      last_name: string
      address_1: string
      address_2?: string
      city: string
      postal_code: string
      country_code: string
      phone?: string
    }
    shipping_method_id: string
    shipping_method_data?: Record<string, unknown>
    carrier_metadata?: Record<string, unknown>
    payment_provider: string
  }
): Promise<{
  cart_id: string
  payment_collection_id: string | null
  client_secret: string | null
  provider_id: string | null
}> {
  const headers = { ...(await getAuthHeaders()) }

  const resp = await sdkFetch<{
    cart_id: string
    payment_collection_id: string | null
    client_secret: string | null
    provider_id: string | null
  }>(`/store/carts/${cartId}/prepare-checkout`, {
    method: "POST",
    headers,
    body: payload,
    cache: "no-store",
  })

  // The backend wrote to the cart (address, shipping, COD-fee, session).
  // Bust the cart cache and re-refresh so any post-call cart read sees
  // the new state. The storefront's Buy click flow doesn't depend on
  // re-reading the cart between prepare and complete (the order_id and
  // client_secret come from `resp`), but other consumers might.
  const cartCacheTag = await getCacheTag("carts")
  updateTag(cartCacheTag)

  return resp
}

export async function refreshPaymentIfTerminal(
  cartId?: string
): Promise<{ rotated: boolean; reason?: string }> {
  const id = cartId || (await getCartId())
  if (!id) return { rotated: false, reason: "no-cart" }

  const headers = { ...(await getAuthHeaders()) }

  try {
    const resp = await sdkFetch<{
      rotated: boolean
      reason?: string
      status?: string
      previous_status?: string
    }>(`/store/carts/${id}/refresh-payment-if-terminal`, {
      method: "POST",
      headers,
      cache: "no-store",
    })
    if (resp.rotated) {
      // Bust the carts cache so the next retrieveCart() in this request
      // sees the rotated session.
      const cartCacheTag = await getCacheTag("carts")
      updateTag(cartCacheTag)
      // And refresh the client router so the storefront's server
      // component re-renders with the rotated session's new
      // client_secret. Stripe Elements re-keys + remounts on it.
      refresh()
    }
    return { rotated: !!resp.rotated, reason: resp.reason }
  } catch {
    // Network blip / backend down — never block render.
    return { rotated: false, reason: "request-failed" }
  }
}

/**
 * Funnel observability event payload. Mirrors the backend's extended
 * `checkout_error_log` schema (medusa-mindpages,
 * src/modules/checkout-error-log/migrations/Migration20260506200000.ts).
 *
 * Required: `errorType`. Everything else optional. Unknown errorType
 * strings get coerced to "other" by the backend, so prefer constants
 * from CHECKOUT_ERROR_TYPES rather than ad-hoc strings.
 */
export type FunnelEventPayload = {
  errorType: string
  errorMessage?: string
  context?: Record<string, unknown>
  /** Originating funnel surface — cart_drawer, pdp, checkout, etc. */
  surface?: string
  /** Severity — critical | high | medium | low | info. */
  severity?: string
  /** Request URL path the event originated from. */
  pagePath?: string
  /** Optional cart override. Defaults to the cookie cart_id when absent. */
  cartId?: string
  /** For logged-in customer attribution. */
  customerId?: string
  /** Set on cart-add / PDP / cart-drawer item failures. */
  productId?: string
  /** Sibling of productId. */
  variantId?: string
  /** Set on subscriber-side and order-confirmed failures. */
  orderId?: string
}

/**
 * Canonical funnel-observability sink. Routes to the cart-scoped
 * backend endpoint when a cart_id is available (cookie or override)
 * and to the cartless sibling otherwise. Never throws.
 *
 * Backend routes:
 *   - POST /store/carts/:id/checkout-error-log   (cart known)
 *   - POST /store/funnel-event-log               (pre-cart, post-order)
 *
 * Both write to the same `checkout_error_log` table — single source of
 * truth for the entire cart→order funnel.
 */
export async function logEvent(payload: FunnelEventPayload): Promise<void> {
  const cartId = payload.cartId ?? (await getCartId())
  const headers = { ...(await getAuthHeaders()) }

  const body = {
    error_type: payload.errorType,
    error_message: payload.errorMessage,
    context: payload.context ?? {},
    surface: payload.surface,
    severity: payload.severity,
    page_path: payload.pagePath,
    customer_id: payload.customerId,
    product_id: payload.productId,
    variant_id: payload.variantId,
    order_id: payload.orderId,
  }

  const path = cartId
    ? `/store/carts/${cartId}/checkout-error-log`
    : `/store/funnel-event-log`

  try {
    await sdkFetch(path, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    })
  } catch {
    // Best-effort — never throw from the logger. If the log POST itself
    // fails (network down, backend 500) the event is dropped. Acceptable;
    // calling sites still console.error the original error so container
    // stderr captures it for forensic recovery.
  }
}

/**
 * Backwards-compatible wrapper for the original 3-arg call shape. New
 * call sites should use `logEvent(...)` directly so they can pass
 * surface / severity / product_id etc.
 *
 * @deprecated Use `logEvent` for new call sites.
 */
export async function logCheckoutError(
  errorType: string,
  errorMessage?: string,
  context?: Record<string, unknown>
): Promise<void> {
  return logEvent({ errorType, errorMessage, context })
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

      refresh()
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
 *
 * `redirectPath` overrides the default post-success redirect URL. Pass
 * a template containing literal `{id}` and `{country}` placeholders —
 * they get substituted with `order.id` and the lowercase country code.
 *
 * Default (backward-compatible): "/{country}/order/{id}/confirmed" — used
 * by stores like MindPages whose URL structure includes the country
 * segment. Stores that flattened away the country segment (e.g., Alenika
 * after commit 85cf5e1) should pass "/order/{id}/confirmed".
 */
export async function placeOrder(
  cartId?: string,
  clientHints?: TrackingClientHints,
  redirectPath?: string
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
      cartRes.order.shipping_address?.country_code?.toLowerCase() ?? ""

    const orderCacheTag = await getCacheTag("orders")
    updateTag(orderCacheTag)

    await removeCartId()

    const template =
      redirectPath ?? "/{country}/order/{id}/confirmed"
    const finalPath = template
      .replace(/\{id\}/g, cartRes.order.id)
      .replace(/\{country\}/g, countryCode)

    redirect(finalPath)
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
