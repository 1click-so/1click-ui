"use client"

import Image from "next/image"

import { convertToLocale } from "../lib/money"
import { useCartDrawer } from "./context"

/**
 * CartFreeGift — a "free gift" promo card shown inside the cart drawer
 * when the cart total exceeds a qualifying threshold.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-free-gift.tsx.
 */

type CartFreeGiftProps = {
  title: string
  description?: string
  originalPrice: number
  currencyCode: string
  thumbnail?: string | null
}

export function CartFreeGift({
  title,
  description,
  originalPrice,
  currencyCode,
  thumbnail,
}: CartFreeGiftProps) {
  const { labels } = useCartDrawer()

  return (
    <div className="mx-5 my-3 p-4 rounded-xl border border-success/20 bg-success/5">
      <div className="flex items-start gap-3">
        {thumbnail && (
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface flex-shrink-0 relative">
            <Image
              src={thumbnail}
              alt={title}
              fill
              className="object-cover"
              sizes="48px"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-base">{title}</span>
            <span className="text-xs text-text-subtle line-through">
              {convertToLocale({
                amount: originalPrice,
                currency_code: currencyCode,
              })}
            </span>
            <span className="text-xs font-bold text-success bg-success/10 px-1.5 py-0.5 rounded">
              {labels.free}
            </span>
          </div>
          {description && (
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
