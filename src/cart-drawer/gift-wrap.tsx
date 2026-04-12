"use client"

import { useState } from "react"

import { DualPrice } from "../lib/dual-price"
import { cn } from "../lib/utils"
import { useCartDrawer } from "./context"

/**
 * CartGiftWrap — inline toggle row for adding gift wrapping to the cart.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-gift-wrap.tsx.
 */

type CartGiftWrapProps = {
  price: number
  currencyCode: string
  enabled?: boolean
  onToggle?: (enabled: boolean) => void
}

export function CartGiftWrap({
  price,
  currencyCode,
  enabled = false,
  onToggle,
}: CartGiftWrapProps) {
  const { labels } = useCartDrawer()
  const [checked, setChecked] = useState(enabled)

  const handleToggle = () => {
    const next = !checked
    setChecked(next)
    onToggle?.(next)
  }

  return (
    <div className="px-5 sm:px-6 py-2">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-3 w-full text-left py-2 min-h-[44px] group"
      >
        <div
          className={cn(
            "w-5 h-5 rounded border-[1.5px] flex items-center justify-center transition-all flex-shrink-0",
            checked
              ? "bg-foreground border-text-base"
              : "border-border group-hover:border-text-muted group-active:border-text-muted"
          )}
        >
          {checked && (
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 5l2 2 4-4" />
            </svg>
          )}
        </div>
        <span className="text-[13px] text-foreground flex-1">
          {labels.addGiftWrap}
        </span>
        <DualPrice
          amount={price}
          currencyCode={currencyCode}
          className="text-[13px] text-muted-foreground font-medium"
          bgnClassName="text-muted-foreground text-[10px] ml-1"
        />
      </button>
    </div>
  )
}
