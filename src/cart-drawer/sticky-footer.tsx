"use client"

import Link from "next/link"

import { DualPrice } from "../lib/dual-price"
import { useCartDrawer } from "./context"

/**
 * CartStickyFooter — bottom-of-drawer subtotal + checkout CTA with
 * iPhone home-indicator safe-area padding.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-sticky-footer.tsx.
 */

export function CartStickyFooter() {
  const { cart, close, labels, hrefs } = useCartDrawer()
  if (!cart || !cart.items?.length) return null

  const total = cart.total ?? 0
  const currencyCode = cart.currency_code

  return (
    <div
      className="flex-shrink-0 bg-surface px-5 sm:px-6 pt-4 sm:pt-5 relative z-10"
      style={{
        boxShadow: "0 -4px 12px rgba(0,0,0,0.04)",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
      }}
    >
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[15px] font-bold text-text-base">
          {labels.subtotal}
        </span>
        <DualPrice
          amount={total}
          currencyCode={currencyCode}
          className="text-xl font-bold text-text-base tracking-tight"
        />
      </div>
      <p className="text-[11px] text-text-subtle mb-3.5 sm:mb-4">
        {labels.taxAndShipping}
      </p>
      <Link href={hrefs.checkout} onClick={close}>
        <button
          type="button"
          className="w-full h-[52px] bg-text-base hover:bg-text-base/90 active:bg-text-base/95 text-surface text-[15px] sm:text-sm font-semibold rounded-2xl flex items-center justify-center gap-2.5 transition-colors active:scale-[0.98]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="6" width="10" height="8" rx="1.5" />
            <path d="M5.5 6V4.5a2.5 2.5 0 015 0V6" />
          </svg>
          {labels.secureCheckout}
        </button>
      </Link>
    </div>
  )
}
