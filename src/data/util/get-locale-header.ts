import { getLocale } from "../locale-actions"

/**
 * Build the `x-medusa-locale` header from the current cookie-based locale.
 * Used by the SDK client wrapper in config.ts to attach a locale to every
 * outgoing request automatically.
 */
export async function getLocaleHeader(): Promise<{
  "x-medusa-locale": string | null
}> {
  const locale = await getLocale()
  return {
    "x-medusa-locale": locale,
  } as const
}
