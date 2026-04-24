"use client"

import type { HttpTypes } from "@medusajs/types"
import { Minus, Plus } from "lucide-react"
import { useState } from "react"

import { updateLineItem } from "../data/cart"
import { DualPrice } from "../lib/dual-price"
import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"

/**
 * CheckoutLineItem — flat row used INSIDE the OrderSummary card. Unlike
 * the cart-drawer LineItemCard (which is itself a card and lives alone
 * in the drawer), this component is borderless: rows sit on the parent
 * card's surface and use a divider above each row from the parent.
 *
 * Checkout is master-level: customers cannot remove items from the
 * order summary. Removal happens in the cart drawer only — the qty
 * pill here allows adjustment down to 1, not zero.
 *
 * Layout:
 *   [thumb 56×56] [title (clamp 2) + variant + qty pill]   [price]
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

  const qtyPill = (
    <div className="inline-flex items-center rounded-[2px] border border-border bg-card">
      <button
        type="button"
        onClick={() => handleQty(item.quantity - 1)}
        disabled={item.quantity <= 1 || updating}
        aria-label={labels.qty}
        className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
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
        className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
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
          row 2: qty pill (left) */}
      <div className="hidden sm:flex flex-1 min-w-0 flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          {titleBlock}
          <DualPrice
            amount={item.total ?? 0}
            currencyCode={currencyCode}
            className="text-sm font-bold text-foreground text-right flex-shrink-0"
          />
        </div>
        {qtyPill}
      </div>

      {/* MOBILE layout — title takes full content width, qty+price share
          the row underneath. */}
      <div className="sm:hidden flex-1 min-w-0 flex flex-col gap-2">
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
    </div>
  )
}
