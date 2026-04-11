/**
 * medusaError — normalize errors from the Medusa JS SDK and legacy Axios shapes.
 *
 * Extracted from mindpages-storefront src/lib/util/medusa-error.ts.
 * Important: as of Medusa JS SDK v2.x, errors are plain objects with
 * `{ status, message }` rather than Axios-style `{ response, request }`.
 * This helper handles both formats so older and newer SDK versions work.
 *
 * Always throws — never returns. Use in `.catch()` chains:
 *
 *   sdk.store.cart.update(...).catch(medusaError)
 */
type MedusaErrorInput = {
  status?: number
  message?: string
  response?: { data?: { message?: string } | string }
  request?: unknown
} & Error

export default function medusaError(error: MedusaErrorInput): never {
  // Medusa JS SDK (v2.x) throws plain objects with status/message
  if (error.status && error.message) {
    const message = error.message
    throw new Error(message.charAt(0).toUpperCase() + message.slice(1) + ".")
  } else if (error.response) {
    // Legacy Axios-style errors
    const data = error.response.data
    const message = typeof data === "string" ? data : data?.message ?? ""
    throw new Error(message.charAt(0).toUpperCase() + message.slice(1) + ".")
  } else if (error.request) {
    throw new Error("No response received: " + String(error.request))
  } else {
    throw new Error("Error setting up the request: " + (error.message ?? "unknown"))
  }
}
