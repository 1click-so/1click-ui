"use client"

import type { HttpTypes } from "@medusajs/types"
import { useState } from "react"

import { applyPromotions } from "../data/cart"
import { convertToLocale } from "../lib/money"
import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"

/**
 * DiscountSection — collapsible promo-code input shown inside the order
 * summary card. Lists currently applied promotions with their discount
 * amount.
 *
 * Extracted from mindpages-storefront checkout-client/index.tsx lines
 * 1536-1683. The dynamic `require()` / `import()` of @lib/data/cart in
 * the original has been replaced with a normal top-level import of
 * `applyPromotions` from the library's own data layer. No more fragile
 * runtime imports.
 */

type DiscountSectionProps = {
  cart: HttpTypes.StoreCart & {
    promotions?: HttpTypes.StorePromotion[]
  }
}

export function DiscountSection({ cart }: DiscountSectionProps) {
  const labels = useCheckoutLabels()
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)

  const promotions = cart.promotions ?? []

  const handleApply = async () => {
    if (!code.trim()) return
    setLoading(true)
    setError("")
    try {
      const codes = promotions.filter((p) => p.code).map((p) => p.code!)
      codes.push(code.trim())
      await applyPromotions(codes)
      setCode("")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full p-4 rounded-xl border border-border bg-muted/50 hover:bg-muted transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-warning to-warning/70 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5 text-card"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 6h.008v.008H6V6z"
            />
          </svg>
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-foreground">
            {labels.discountCode}
          </p>
          <p className="text-xs text-muted-foreground">{labels.discountSub}</p>
        </div>
        <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
          {labels.addCode}
          <svg
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
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
        </span>
      </button>

      {open && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="PROMO2024"
            className="flex-1 h-11 px-4 text-sm bg-card border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={loading || !code.trim()}
            className="px-5 h-11 text-sm font-semibold bg-foreground text-card rounded-xl hover:bg-foreground/90 transition-all disabled:opacity-40"
          >
            {labels.addCode}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive mt-2">{error}</p>}

      {promotions.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {promotions.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-4 py-2.5 bg-success/10 border border-success/20 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-semibold text-success">
                  {p.code}
                </span>
              </div>
              <span className="text-sm font-medium text-success">
                {p.application_method?.type === "percentage"
                  ? `-${p.application_method.value}%`
                  : p.application_method?.value && p.application_method?.currency_code
                    ? `-${convertToLocale({
                        amount: +p.application_method.value,
                        currency_code: p.application_method.currency_code,
                      })}`
                    : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
