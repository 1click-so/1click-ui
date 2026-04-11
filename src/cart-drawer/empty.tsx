"use client"

import Link from "next/link"

import { useCartDrawer } from "./context"

/**
 * CartEmpty — empty-state for the cart drawer.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-empty.tsx.
 */

export function CartEmpty() {
  const { close, labels, hrefs } = useCartDrawer()

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
      <div className="w-16 h-16 rounded-full bg-surface-muted flex items-center justify-center mb-5">
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          stroke="currentColor"
          className="text-text-subtle"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8h16l-1.5 14H7.5L6 8z" />
          <path d="M10 8V6a4 4 0 018 0v2" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-text-base mb-1.5">
        {labels.emptyCartTitle}
      </h3>
      <p className="text-sm text-text-muted text-center mb-6 max-w-[240px]">
        {labels.emptyCartMessage}
      </p>
      <Link href={hrefs.browse} onClick={close}>
        <button
          type="button"
          className="px-6 py-2.5 bg-text-base text-surface text-sm font-medium rounded-xl hover:bg-text-base/90 transition-colors active:scale-[0.97]"
        >
          {labels.browseProducts}
        </button>
      </Link>
    </div>
  )
}
