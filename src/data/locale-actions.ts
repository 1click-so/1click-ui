"use server"

import { updateTag } from "next/cache"
import { cookies as nextCookies } from "next/headers"

import { sdk, sdkFetch } from "./config"
import { getAuthHeaders, getCacheTag, getCartId } from "./cookies"

/**
 * Locale state — cookie read/write + cart locale sync.
 *
 * The storefront's active locale is stored in a cookie (_medusa_locale) and
 * also synced to the cart's `locale` field so server-side notifications
 * (emails, admin displays) can render in the customer's language.
 */

const LOCALE_COOKIE_NAME = "_medusa_locale"

/** Read the current locale from cookies. Returns null if unset. */
export const getLocale = async (): Promise<string | null> => {
  try {
    const cookies = await nextCookies()
    return cookies.get(LOCALE_COOKIE_NAME)?.value ?? null
  } catch {
    return null
  }
}

/** Write the locale cookie. */
export const setLocaleCookie = async (locale: string): Promise<void> => {
  const cookies = await nextCookies()
  cookies.set(LOCALE_COOKIE_NAME, locale, {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false, // allow client-side read
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

/**
 * Change the active locale. Writes the cookie, updates the active cart's
 * locale field if one exists, and revalidates product/category/collection
 * caches so the storefront re-renders in the new locale.
 */
export const updateLocale = async (localeCode: string): Promise<string> => {
  await setLocaleCookie(localeCode)

  const cartId = await getCartId()
  if (cartId) {
    const headers = { ...(await getAuthHeaders()) }
    await sdk.store.cart.update(cartId, { locale: localeCode }, {}, headers)

    const cartCacheTag = await getCacheTag("carts")
    if (cartCacheTag) updateTag(cartCacheTag)
  }

  const productsCacheTag = await getCacheTag("products")
  if (productsCacheTag) updateTag(productsCacheTag)

  const categoriesCacheTag = await getCacheTag("categories")
  if (categoriesCacheTag) updateTag(categoriesCacheTag)

  const collectionsCacheTag = await getCacheTag("collections")
  if (collectionsCacheTag) updateTag(collectionsCacheTag)

  return localeCode
}
