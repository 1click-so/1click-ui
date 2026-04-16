"use client"

import type { HttpTypes } from "@medusajs/types"
import { Minus, Plus, X } from "lucide-react"
import { useState } from "react"

import { deleteLineItem, updateLineItem } from "../data/cart"
import { DualPrice } from "../lib/dual-price"
import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"

/**
 * CheckoutLineItem — flat row used INSIDE the OrderSummary card. Unlike
 * the cart-drawer LineItemCard (which is itself a card and lives alone
 * in the drawer), this component is borderless: rows sit on the parent
 * card's surface and use a divider above each row from the parent. That
 * gives the title ~70% of the row width — critical inside the narrow
 * sidebar/mobile-summary container where nested-card chrome was eating
 * the title down to "Стартов к..." ellipsis.
 *
 * Layout:
 *   [thumb 56×56] [title (clamp 2) + variant + qty pill]   [price + ✕]
 */

type CheckoutLineItemProps = {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
}

export function CheckoutLineItem({ item, currencyCode }: CheckoutLineItemProps) {
  const labels = useCheckoutLabels()
  const [updating, setUpdating] = useState(false)

  const handleQty = async (qty: number) => {
    if (qty < 1) return
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

  const qtyPill = (
    <div className="inline-flex items-center rounded-full border border-border bg-card">
      <button
        type="button"
        onClick={() => handleQty(item.quantity - 1)}
        disabled={item.quantity <= 1 || updating}
        aria-label={labels.remove}
        className="w-8 h-8 flex items-center justify-center rounded-full text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Minus className="w-3.5 h-3.5" strokeWidth={2.25} />
      </button>
      <span className="min-w-[1.75rem] px-1 text-center text-xs font-semibold tabular-nums">
        {item.quantity}
      </span>
      <button
        type="button"
        onClick={() => handleQty(item.quantity + 1)}
        disabled={updating}
        aria-label={labels.qty}
        className="w-8 h-8 flex items-center justify-center rounded-full text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
      </button>
    </div>
  )

  const titleBlock = (
    <div className="min-w-0">
      <p className="text-[15px] font-semibold text-foreground leading-snug break-words">
        {item.product_title}
      </p>
      {item.variant?.title && item.variant.title !== "Default" && (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {item.variant.title}
        </p>
      )}
    </div>
  )

  const removeBtn = (
    <button
      type="button"
      onClick={handleRemove}
      aria-label={labels.remove}
      className="w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <X className="w-3.5 h-3.5" strokeWidth={2} />
    </button>
  )

  return (
    <div
      className={cn(
        "relative flex gap-4 transition-opacity",
        updating && "opacity-40 pointer-events-none"
      )}
    >
      <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-muted border border-border">
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt={item.product_title || ""}
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>

      {/* DESKTOP layout —
          row 1: title (left)  ·  price right-aligned, baseline of title line 1
          row 2: qty pill (left) ·  X (right) */}
      <div className="hidden sm:flex flex-1 min-w-0 flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          {titleBlock}
          <DualPrice
            amount={item.total ?? 0}
            currencyCode={currencyCode}
            className="text-sm font-bold text-foreground text-right flex-shrink-0"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          {qtyPill}
          {removeBtn}
        </div>
      </div>

      {/* MOBILE layout — title takes full content width, qty+price share
          the row underneath. X floats absolute in the top-right of the
          whole row, out of flow. */}
      <div className="sm:hidden flex-1 min-w-0 flex flex-col gap-2 pr-7">
        {titleBlock}
        <div className="flex items-center justify-between gap-3">
          {qtyPill}
          <DualPrice
            amount={item.total ?? 0}
            currencyCode={currencyCode}
            className="text-sm font-bold text-foreground text-right"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={handleRemove}
        aria-label={labels.remove}
        className="sm:hidden absolute -top-1 -right-1 w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors z-10"
      >
        <X className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}
