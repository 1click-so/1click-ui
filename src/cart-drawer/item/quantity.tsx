"use client"

import { useState } from "react"

import { updateLineItem } from "../../data/cart"
import { cn } from "../../lib/utils"

/**
 * CartItemQuantity — +/- quantity stepper for a single cart line item.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-item-quantity.tsx.
 * Uses the library's `updateLineItem` SDK wrapper.
 */

type CartItemQuantityProps = {
  lineId: string
  quantity: number
  maxQuantity?: number
  className?: string
}

export function CartItemQuantity({
  lineId,
  quantity,
  maxQuantity = 10,
  className,
}: CartItemQuantityProps) {
  const [updating, setUpdating] = useState(false)

  const change = async (newQty: number) => {
    if (newQty < 1 || newQty > maxQuantity || updating) return
    setUpdating(true)
    try {
      await updateLineItem({ lineId, quantity: newQty })
    } catch (e) {
      console.error("Failed to update quantity", e)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div
      className={cn(
        "inline-flex items-center border border-border rounded-lg h-9",
        updating && "opacity-50 pointer-events-none",
        className
      )}
    >
      <button
        type="button"
        onClick={() => change(quantity - 1)}
        disabled={quantity <= 1}
        className="w-9 h-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
        aria-label="Decrease quantity"
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
          <path d="M2.5 6h7" />
        </svg>
      </button>
      <span className="w-8 text-center text-sm font-medium text-foreground tabular-nums select-none">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => change(quantity + 1)}
        disabled={quantity >= maxQuantity}
        className="w-9 h-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
        aria-label="Increase quantity"
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
  )
}
