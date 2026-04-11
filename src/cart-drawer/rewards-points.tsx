"use client"

import { useState } from "react"

import { cn } from "../lib/utils"
import { useCartDrawer } from "./context"

/**
 * CartRewardsPoints — expandable row that previews how many reward points
 * the current cart earns.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-rewards-points.tsx.
 */

type CartRewardsPointsProps = {
  points: number
  label?: string
  details?: string
}

export function CartRewardsPoints({
  points,
  label,
  details,
}: CartRewardsPointsProps) {
  const { labels } = useCartDrawer()
  const [expanded, setExpanded] = useState(false)

  if (points <= 0) return null

  return (
    <div className="mx-5 sm:mx-6 my-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl bg-success/10 text-success hover:bg-success/20 active:bg-success/20 transition-colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0"
        >
          <path d="M9 1l2.47 5.01 5.53.8-4 3.9.94 5.49L9 13.76l-4.94 2.44.94-5.49-4-3.9 5.53-.8L9 1z" />
        </svg>
        <span className="text-[13px] sm:text-sm font-medium flex-1 text-left">
          {label || labels.estimatedRewardPoints}:{" "}
          <span className="font-bold">{points.toLocaleString()}</span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("transition-transform", expanded && "rotate-180")}
        >
          <path d="M3.5 5.5l3.5 3 3.5-3" />
        </svg>
      </button>
      {expanded && details && (
        <div className="px-4 py-2.5 text-xs text-success leading-relaxed">
          {details}
        </div>
      )}
    </div>
  )
}
