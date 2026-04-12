"use client"

import Image from "next/image"
import Link from "next/link"
import { useRef, useState } from "react"

import { DualPrice } from "../lib/dual-price"
import { cn } from "../lib/utils"
import { useCartDrawer } from "./context"

/**
 * CartCrossSellCarousel — horizontal scrollable product strip with left/right
 * arrow controls. Used as mobile alternative to the sidebar or as a second
 * cross-sell zone below the line items on desktop.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-cross-sell-carousel.tsx.
 */

export type CrossSellCarouselProduct = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  price: number
  currencyCode: string
  variantId?: string
}

type CartCrossSellCarouselProps = {
  label?: string
  products: CrossSellCarouselProduct[]
  onAdd?: (productId: string, variantId?: string) => void
}

export function CartCrossSellCarousel({
  label,
  products,
  onAdd,
}: CartCrossSellCarouselProps) {
  const { labels, hrefs } = useCartDrawer()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 4)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4)
  }

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({
      left: dir === "left" ? -260 : 260,
      behavior: "smooth",
    })
    setTimeout(checkScroll, 350)
  }

  if (!products.length) return null

  return (
    <div className="border-t border-border bg-muted/50 py-4">
      <div className="flex items-center justify-between px-5 sm:px-6 mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {label ?? labels.youllLoveThis}
        </h3>
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:border-text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Scroll left"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8.5 3L4.5 7l4 4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:border-text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Scroll right"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5.5 3l4 4-4 4" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-2.5 overflow-x-auto no-scrollbar"
        style={{
          WebkitOverflowScrolling: "touch",
          paddingLeft: "1.25rem",
          paddingRight: "1.25rem",
        }}
      >
        {products.map((product) => (
          <div
            key={product.id}
            className={cn(
              "flex-shrink-0 w-[260px] bg-card rounded-xl border border-border p-2.5",
              "flex gap-3 items-center snap-start"
            )}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <Link
              href={`${hrefs.productPrefix}/${product.handle}`}
              className="flex-shrink-0"
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted relative">
                {product.thumbnail ? (
                  <Image
                    src={product.thumbnail}
                    alt={product.title}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg
                      width="16"
                      height="16"
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

            <div className="flex-1 min-w-0">
              <Link
                href={`${hrefs.productPrefix}/${product.handle}`}
                className="text-[12px] font-semibold text-foreground line-clamp-1 leading-snug hover:text-muted-foreground transition-colors block"
              >
                {product.title}
              </Link>
              <DualPrice
                amount={product.price}
                currencyCode={product.currencyCode}
                className="text-[13px] font-bold text-foreground block mt-0.5"
                bgnClassName="text-muted-foreground text-[10px] ml-1"
              />
            </div>

            <button
              type="button"
              onClick={() => onAdd?.(product.id, product.variantId)}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:border-text-base hover:text-foreground active:bg-muted transition-all"
              aria-label={`${labels.addToCart} ${product.title}`}
            >
              <svg
                width="14"
                height="14"
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
