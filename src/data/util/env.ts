/**
 * Resolve the public base URL of the consuming storefront.
 * Used for metadata (OpenGraph, canonical URLs, etc.).
 */
export const getBaseURL = (): string => {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://localhost:8000"
}
