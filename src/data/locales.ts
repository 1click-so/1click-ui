"use server"

import { sdk, sdkFetch } from "./config"
import { getCacheOptions } from "./cookies"

/**
 * Available locales from the backend.
 *
 * Extracted from mindpages-storefront src/lib/data/locales.ts. Returns
 * null if the backend's /store/locales endpoint is not configured (404).
 */

export type Locale = {
  code: string
  name: string
}

export const listLocales = async (): Promise<Locale[] | null> => {
  const next = { ...(await getCacheOptions("locales")) }

  return sdkFetch<{ locales: Locale[] }>(`/store/locales`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ locales }) => locales)
    .catch(() => null)
}
