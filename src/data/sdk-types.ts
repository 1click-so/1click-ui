/**
 * Medusa SDK type augmentation for Next.js fetch extensions.
 *
 * The Medusa JS SDK's `FetchArgs` type is `Omit<RequestInit, ...>` which
 * loses Next.js's runtime extensions to fetch (`next: { revalidate, tags }`
 * and the widened `cache` strings). Internally the SDK just forwards the
 * init object to Next.js's fetch, so these fields work at runtime — only
 * the types are missing.
 *
 * We export a single `FetchInit` type that's `FetchArgs` plus the Next.js
 * fields, and every call in the data layer uses `FetchInit` when building
 * its fetch options. This keeps the call sites clean (no casts) and
 * isolates the SDK type patch in one place — easy to remove if/when the
 * Medusa SDK is swapped out during the backend rebuild.
 */

import type { FetchArgs } from "@medusajs/js-sdk"

export type FetchInit = FetchArgs & {
  next?: {
    revalidate?: number | false
    tags?: string[]
  }
  cache?: RequestCache
}
