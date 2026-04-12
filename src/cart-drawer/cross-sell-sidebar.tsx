"use client"

import Image from "next/image"
import Link from "next/link"

import { convertToLocale } from "../lib/money"
import { useCartDrawer } from "./context"

/**
 * CartCrossSellSidebar — vertical product-card list for desktop cart
 * drawer's left sidebar.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-cross-sell-sidebar.tsx.
 */

export type CrossSellSidebarProduct = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  price: number
  currencyCode: string
  variantId?: string
}

type CartCrossSellSidebarProps = {
  label?: string
  products: CrossSellSidebarProduct[]
  onAdd?: (productId: string, variantId?: string) => void
}

export function CartCrossSellSidebar({
  label,
  products,
  onAdd,
}: CartCrossSellSidebarProps) {
  const { labels, hrefs } = useCartDrawer()

  if (!products.length) return null

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-6 pb-4">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">
          {label ?? labels.youMightAlsoLike}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-card rounded-2xl p-3.5 transition-shadow hover:shadow-md"
            style={{
              boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.08)",
            }}
          >
            <Link href={`${hrefs.productPrefix}/${product.handle}`}>
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-muted relative mb-3">
                {product.thumbnail ? (
                  <Image
                    src={product.thumbnail}
                    alt={product.title}
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="text-muted-foreground"
                      strokeWidth="1.2"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path
                        d="M21 15l-5-5L5 21"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </Link>
            <Link
              href={`${hrefs.productPrefix}/${product.handle}`}
              className="text-[13px] font-semibold text-foreground leading-tight line-clamp-2 hover:text-muted-foreground transition-colors block"
            >
              {product.title}
            </Link>
            <p className="text-sm font-semibold text-foreground mt-1.5">
              {convertToLocale({
                amount: product.price,
                currency_code: product.currencyCode,
              })}
            </p>
            <button
              type="button"
              onClick={() => onAdd?.(product.id, product.variantId)}
              className="mt-3 w-full h-10 text-xs font-semibold text-foreground bg-card border border-border rounded-xl hover:bg-foreground hover:text-card hover:border-text-base transition-all flex items-center justify-center gap-1.5 active:scale-[0.97]"
            >
              {labels.addToCart}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M2.5 6h7M7 3.5L9.5 6 7 8.5" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
