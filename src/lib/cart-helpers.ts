import type { HttpTypes } from "@medusajs/types"

/**
 * Cart line predicates and product-only totals helpers.
 *
 * Why this exists. Medusa v2 has no native "fee" / "surcharge" primitive
 * (verified — adjustments are scoped to line_items or shipping_methods,
 * see node_modules/@medusajs/types/dist/order/common.d.ts:79-105). The
 * canonical way to add a non-product charge that flows through totals,
 * tax, and refund pipelines is a line item with a metadata flag —
 * which is what the COD-fee middleware does at
 * medusa-mindpages/src/api/store/payment-collections/[id]/payment-sessions/middleware.ts.
 *
 * The trade-off: that line item appears in cart.items everywhere — the
 * cart drawer, order page, mobile bars, anything that iterates the
 * cart. Without filtering it appears as a fake product (empty
 * thumbnail + qty stepper). With each surface filtering inline we get
 * 8+ copies of the same predicate that drift apart over time.
 *
 * Single source of truth. Every customer-facing render surface that
 * iterates `cart.items` (or `order.items`) calls `isProductLine`.
 * Every total computed for a customer-facing context (drawer footer,
 * pre-checkout subtotal display) calls `productTotal`. If we ever add
 * another surcharge type, the predicate gets one new check; every
 * surface inherits it.
 *
 * Where this is NOT used. The checkout summary and the order totals
 * intentionally render the fee — there it's a separate "Cash on
 * delivery fee" row in the totals breakdown, sourced from
 * `findFeeLine`. Customer SHOULD see the fee in checkout / on the
 * order; they should NOT see it in the cart drawer pre-checkout.
 */

export const COD_FEE_METADATA_KEY = "is_cod_fee"

type LineLike = {
  metadata?: Record<string, unknown> | null
  total?: number | null
  subtotal?: number | null
  unit_price?: number | null
  quantity?: number
}

/**
 * Returns true when the line is a customer-facing product (anything
 * the customer chose to buy), false for backend-injected fee lines.
 *
 * Tight check: only excludes lines explicitly tagged `is_cod_fee=true`.
 * Lines with no metadata, null metadata, or any other metadata pass
 * through unchanged — never filter a real product because of a
 * missing flag.
 */
export function isProductLine(item: LineLike): boolean {
  const meta = item.metadata
  if (!meta || typeof meta !== "object") return true
  return (meta as Record<string, unknown>)[COD_FEE_METADATA_KEY] !== true
}

/** Inverse of `isProductLine`. Useful when the caller needs the fee. */
export function isFeeLine(item: LineLike): boolean {
  return !isProductLine(item)
}

/**
 * Sum of line totals for product lines only. Suitable for cart-drawer
 * surfaces in pre-checkout context where shipping/tax/fees should NOT
 * leak into the displayed subtotal.
 *
 * Reads `item.total` (gross of tax for tax-inclusive items, post-line-
 * adjustments) which matches what every cart surface already shows on
 * a per-line basis — keeps the visible per-line price and the visible
 * subtotal arithmetically consistent.
 */
export function productTotal(items: readonly LineLike[] | null | undefined): number {
  if (!items?.length) return 0
  let sum = 0
  for (const item of items) {
    if (!isProductLine(item)) continue
    sum += Number(item.total ?? 0)
  }
  return sum
}

/** Sum of `quantity` over product lines only. */
export function productItemCount(
  items: readonly LineLike[] | null | undefined
): number {
  if (!items?.length) return 0
  let count = 0
  for (const item of items) {
    if (!isProductLine(item)) continue
    count += Number(item.quantity ?? 0)
  }
  return count
}

/**
 * The fee line item from a cart or order, if present. Returns null
 * when no fee was applied (Card flow, or middleware skipped due to
 * config / currency mismatch).
 */
export function findFeeLine<
  T extends HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
>(items: readonly T[] | null | undefined): T | null {
  if (!items?.length) return null
  for (const item of items) {
    if (isFeeLine(item)) return item
  }
  return null
}
