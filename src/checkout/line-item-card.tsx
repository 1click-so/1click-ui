"use client"

import type { HttpTypes } from "@medusajs/types"
import { useState } from "react"

import { deleteLineItem, updateLineItem } from "../data/cart"
import { DualPrice } from "../lib/dual-price"
import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"

/**
 * LineItemCard — a single cart line shown inside the checkout order
 * summary card. Includes thumbnail, title, variant, quantity select,
 * remove button, and dual-currency price.
 *
 * Extracted from mindpages-storefront checkout-client/index.tsx lines
 * 1392-1530 (originally named `ProductCard` inside OrderSummary).
 */

type LineItemCardProps = {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
}

export function LineItemCard({ item, currencyCode }: LineItemCardProps) {
  const labels = useCheckoutLabels()
  const [updating, setUpdating] = useState(false)

  const handleQty = async (qty: number) => {
    setUpdating(true)
    try {
      await updateLineItem({ lineId: item.id, quantity: qty })
    } finally {
      setUpdating(false)
    }
  }

  const handleRemove = async () => {
    setUpdating(true)
    try {
      await deleteLineItem(item.id)
    } finally {
      setUpdating(false)
    }
  }

  const total = item.total ?? 0

  return (
    <div
      className={cn(
        "relative flex gap-4 p-4 rounded-xl border border-border bg-surface-muted/50 transition-opacity",
        updating && "opacity-40 pointer-events-none"
      )}
    >
      <button
        type="button"
        onClick={handleRemove}
        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-surface-muted hover:bg-border flex items-center justify-center transition-colors group"
        aria-label={labels.remove}
      >
        <svg
          className="w-3 h-3 text-text-muted group-hover:text-text-base"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-surface border border-border">
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt={item.product_title || ""}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-text-subtle"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
        )}
        {item.quantity > 1 && (
          <span className="absolute -bottom-1 -left-1 w-5 h-5 text-[10px] font-bold rounded-full bg-text-base text-surface flex items-center justify-center shadow-sm">
            {item.quantity}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 pr-5">
        <p className="text-sm font-semibold text-text-base leading-tight truncate">
          {item.product_title}
        </p>
        {item.variant?.title && item.variant.title !== "Default" && (
          <p className="text-xs text-text-muted mt-1">{item.variant.title}</p>
        )}

        <div className="flex items-center gap-2 mt-2.5">
          <div className="relative">
            <select
              value={item.quantity}
              onChange={(e) => handleQty(parseInt(e.target.value, 10))}
              className="h-8 pl-2.5 pr-7 text-xs font-medium border border-border rounded-lg bg-surface text-text-base appearance-none cursor-pointer hover:border-text-subtle transition-colors focus:outline-none focus:ring-1 focus:ring-accent/20"
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {labels.qty} {i + 1}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-subtle pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end justify-center flex-shrink-0">
        <DualPrice
          amount={total}
          currencyCode={currencyCode}
          className="text-sm font-bold text-text-base"
        />
      </div>
    </div>
  )
}
