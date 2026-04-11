"use client"

import type { HttpTypes } from "@medusajs/types"

/**
 * CartItemVariant — renders the variant option values (e.g. "Size M / Red")
 * under the product title in a cart line.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-item-variant.tsx.
 */

type CartItemVariantProps = {
  variant?: HttpTypes.StoreProductVariant | null
}

export function CartItemVariant({ variant }: CartItemVariantProps) {
  if (!variant?.options?.length) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {variant.options.map((opt, i) => (
        <span key={i} className="text-xs text-text-muted">
          {opt.value}
          {i < (variant.options?.length || 0) - 1 && (
            <span className="ml-2 text-text-subtle">/</span>
          )}
        </span>
      ))}
    </div>
  )
}
