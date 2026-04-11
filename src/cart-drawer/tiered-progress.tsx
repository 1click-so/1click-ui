"use client"

import { convertToLocale } from "../lib/money"
import { useCartDrawer } from "./context"

/**
 * Tiered progress bar — shows how far the cart subtotal is from the next
 * shipping/discount tier, with checkpoint markers along the bar.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-tiered-progress.tsx.
 */

export type CartTier = {
  threshold: number
  label: string
  icon?: "shipping" | "discount" | "gift"
}

type CartTieredProgressProps = {
  tiers: CartTier[]
  currencyCode: string
}

export function CartTieredProgress({
  tiers,
  currencyCode,
}: CartTieredProgressProps) {
  const { cart, labels } = useCartDrawer()
  // Tax-inclusive total
  const subtotal = cart?.total ?? 0

  if (tiers.length === 0) return null

  const maxThreshold = tiers[tiers.length - 1]!.threshold
  const progressPercent = Math.min((subtotal / maxThreshold) * 100, 100)
  const nextTier = tiers.find((t) => subtotal < t.threshold)

  return (
    <div
      className="px-6 pt-4 pb-5 flex-shrink-0 relative z-10 bg-surface border-b border-border"
      style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}
    >
      {nextTier ? (
        <p className="text-[13px] text-text-muted mb-4">
          <span className="font-bold text-text-base">
            {convertToLocale({
              amount: nextTier.threshold - subtotal,
              currency_code: currencyCode,
            })}
          </span>{" "}
          {labels.awayFromFreeShipping}
        </p>
      ) : (
        <p className="text-[13px] text-success font-medium mb-4">
          {labels.allRewardsUnlocked}
        </p>
      )}

      <div className="relative px-3">
        <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progressPercent}%`,
              background:
                progressPercent >= 100
                  ? "linear-gradient(90deg, hsl(var(--color-success)), hsl(var(--color-success) / 0.7))"
                  : "linear-gradient(90deg, hsl(var(--color-text-base)), hsl(var(--color-text-base) / 0.75))",
            }}
          />
        </div>

        {tiers.map((tier, i) => {
          const position = (tier.threshold / maxThreshold) * 100
          const achieved = subtotal >= tier.threshold

          return (
            <div
              key={i}
              className="absolute top-0"
              style={{ left: `${position}%` }}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center -translate-x-1/2 -translate-y-[6px] border-[2.5px] border-surface ${
                  achieved ? "bg-success" : "bg-surface-muted"
                }`}
              >
                {achieved && (
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 5l2.5 2.5L8 3" />
                  </svg>
                )}
              </div>
              <div className="-translate-x-1/2 mt-1.5 whitespace-nowrap text-center">
                <span
                  className={`text-[10px] block leading-tight font-medium ${
                    achieved ? "text-success" : "text-text-subtle"
                  }`}
                >
                  {tier.label}
                </span>
                <span
                  className={`text-[10px] block leading-tight tabular-nums ${
                    achieved ? "text-success" : "text-text-subtle"
                  }`}
                >
                  {convertToLocale({
                    amount: tier.threshold,
                    currency_code: currencyCode,
                  })}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="h-8" />
    </div>
  )
}
