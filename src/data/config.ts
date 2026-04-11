import Medusa, { type FetchArgs, type FetchInput } from "@medusajs/js-sdk"

import { getLocaleHeader } from "./util/get-locale-header"
import type { FetchInit } from "./sdk-types"

/**
 * SDK client — the single Medusa JS SDK instance every data wrapper
 * in this library uses. Reads its backend URL and publishable key from
 * environment variables in the consuming store.
 *
 * Required env:
 *   - MEDUSA_BACKEND_URL                    (server-side)
 *   - NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY    (public)
 *
 * The SDK's fetch is wrapped once on instantiation to auto-inject the
 * `x-medusa-locale` header from the cookie-based locale state on every
 * request. This means any call — `sdk.store.cart.update(...)` or the
 * lower-level `sdk.client.fetch(...)` — is locale-aware without the
 * caller having to remember.
 *
 * When the backend is rebuilt to Next.js, THIS file is the seam where
 * the library swaps from Medusa's SDK to a new internal HTTP client.
 * The public surface of every `data/*.ts` wrapper stays identical, so
 * consuming stores don't notice the change.
 */

const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})

const originalFetch = sdk.client.fetch.bind(sdk.client)

sdk.client.fetch = async <T>(
  input: FetchInput,
  init?: FetchArgs
): Promise<T> => {
  const headers = init?.headers ?? {}
  let localeHeader: Record<string, string | null> | undefined
  try {
    localeHeader = await getLocaleHeader()
    if (localeHeader["x-medusa-locale"] && !(headers as Record<string, unknown>)["x-medusa-locale"]) {
      ;(headers as Record<string, string | null>)["x-medusa-locale"] =
        localeHeader["x-medusa-locale"]
    }
  } catch {
    // locale is best-effort; proceed without it
  }

  const newHeaders = {
    ...localeHeader,
    ...headers,
  }
  const nextInit: FetchArgs = {
    ...init,
    headers: newHeaders as FetchArgs["headers"],
  }
  return originalFetch(input, nextInit)
}

/**
 * Typed wrapper around `sdk.client.fetch` that accepts Next.js fetch
 * extensions (`next`, extended `cache`). Prefer this over calling
 * `sdk.client.fetch` directly so every data-layer file gets proper types
 * for Next.js caching options.
 */
export function sdkFetch<T>(input: FetchInput, init?: FetchInit): Promise<T> {
  return sdk.client.fetch<T>(input, init as FetchArgs)
}
