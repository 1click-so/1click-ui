"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, type ReactNode } from "react"
import type { HttpTypes } from "@medusajs/types"

import { deleteLineItem } from "../../data/cart"
import { DualPrice } from "../../lib/dual-price"
import { cn } from "../../lib/utils"
import { useCartDrawer } from "../context"
import { CartItemQuantity } from "./quantity"
import { CartItemVariant } from "./variant"

/**
 * CartItem — a single cart line row: thumbnail, title, variant, quantity
 * stepper, price (with dual-currency + optional strikethrough), remove button.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-item.tsx.
 * Uses the library's DualPrice, updateLineItem, deleteLineItem, and the
 * cart drawer context for labels + product link prefix.
 *
 * `children` is rendered below the main row — intended for per-item upsell
 * slots (see `CartItemUpsell` in `./upsell.tsx`).
 */

type CartItemProps = {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
  children?: ReactNode
}

export function CartItem({ item, currencyCode, children }: CartItemProps) {
  const { labels, hrefs } = useCartDrawer()
  const [removing, setRemoving] = useState(false)

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await deleteLineItem(item.id)
    } catch {
      setRemoving(false)
    }
  }

  const total = item.total ?? 0
  const originalTotal = item.original_total ?? 0
  const hasDiscount = total < originalTotal
  const productHref = `${hrefs.productPrefix}/${item.product_handle}`

  return (
    <div
      className={cn(
        "px-6 py-5 transition-opacity",
        removing && "opacity-30 pointer-events-none"
      )}
    >
      <div className="flex gap-4">
        <Link href={productHref} className="flex-shrink-0">
          <div
            className="w-[64px] h-[84px] sm:w-[72px] sm:h-[72px] rounded-xl overflow-hidden bg-surface-muted relative"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
          >
            {item.thumbnail ? (
              <Image
                src={item.thumbnail}
                alt={item.product_title || ""}
                fill
                className="object-cover"
                sizes="72px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="text-text-subtle"
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

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={productHref}
                className="text-sm font-semibold text-text-base hover:text-text-muted transition-colors line-clamp-2 leading-snug block"
              >
                {item.product_title}
              </Link>
              <CartItemVariant variant={item.variant} />
            </div>
            <div className="text-right flex-shrink-0">
              {hasDiscount && (
                <span className="text-xs text-text-subtle line-through block leading-none mb-0.5">
                  <DualPrice
                    amount={originalTotal}
                    currencyCode={currencyCode}
                    className="text-xs text-text-subtle"
                    bgnClassName="hidden"
                  />
                </span>
              )}
              <DualPrice
                amount={total}
                currencyCode={currencyCode}
                className={cn(
                  "text-sm font-bold",
                  hasDiscount ? "text-success" : "text-text-base"
                )}
                bgnClassName="text-text-subtle text-[10px] ml-1"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <CartItemQuantity lineId={item.id} quantity={item.quantity} />
            <button
              type="button"
              onClick={handleRemove}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-subtle hover:text-danger hover:bg-danger/10 transition-all"
              aria-label={labels.remove}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 4.5h11M5.5 4.5V3a1 1 0 011-1h3a1 1 0 011 1v1.5M12.5 4.5v9a1 1 0 01-1 1h-7a1 1 0 01-1-1v-9" />
                <path d="M6.5 7v4M9.5 7v4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {children}
      <div className="mt-5 border-b border-border" />
    </div>
  )
}
