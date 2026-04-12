"use client"

import { useCartDrawer } from "./context"

/**
 * Cart drawer header — store title, item count badge, close button.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-drawer-header.tsx.
 * Tokens + `labels` from context replace hardcoded zinc palette and Bulgarian strings.
 */

export function CartDrawerHeader() {
  const { close, cart, labels } = useCartDrawer()
  const totalItems = cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0

  return (
    <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 flex-shrink-0 bg-card">
      <div className="flex items-center gap-2.5">
        <h2 className="text-base sm:text-[17px] font-bold text-foreground tracking-tight">
          {labels.yourCart}
        </h2>
        {totalItems > 0 && (
          <span className="text-[11px] font-semibold text-muted-foreground bg-muted rounded-full px-2.5 py-1 leading-none">
            {totalItems} {totalItems === 1 ? labels.item : labels.items}
          </span>
        )}
      </div>
      <button
        onClick={close}
        className="w-11 h-11 -mr-1.5 flex items-center justify-center rounded-full hover:bg-muted active:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label={labels.closeCart}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  )
}
