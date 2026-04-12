"use client"

import Image from "next/image"
import Link from "next/link"

import { convertToLocale } from "../../lib/money"
import { useCartDrawer } from "../context"

/**
 * CartItemUpsell — slot rendered INSIDE a cart item for per-product
 * complementary recommendations. Accepts a list of products and an
 * onAdd handler.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-item-upsell.tsx.
 */

export type UpsellProduct = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  price: number
  currencyCode: string
}

type CartItemUpsellProps = {
  label?: string
  products: UpsellProduct[]
  onAdd?: (productId: string) => void
}

export function CartItemUpsell({
  label,
  products,
  onAdd,
}: CartItemUpsellProps) {
  const { labels, hrefs } = useCartDrawer()
  if (!products.length) return null

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        {label ?? labels.pairsWellWith}
      </p>
      <div className="space-y-2">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-3 p-2 rounded-lg bg-muted hover:bg-muted/70 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-card flex-shrink-0 relative">
              {product.thumbnail ? (
                <Image
                  src={product.thumbnail}
                  alt={product.title}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              ) : (
                <div className="w-full h-full bg-muted" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`${hrefs.productPrefix}/${product.handle}`}
                className="text-xs font-medium text-foreground truncate block"
              >
                {product.title}
              </Link>
              <span className="text-xs text-muted-foreground">
                {convertToLocale({
                  amount: product.price,
                  currency_code: product.currencyCode,
                })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onAdd?.(product.id)}
              className="w-7 h-7 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:border-text-base hover:text-foreground transition-colors flex-shrink-0"
              aria-label={`${labels.addToCart} ${product.title}`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M6 2.5v7M2.5 6h7" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
