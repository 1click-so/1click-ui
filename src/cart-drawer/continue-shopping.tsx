"use client"

import { useCartDrawer } from "./context"

/**
 * CartContinueShopping — tiny "continue shopping" text link under the
 * sticky footer.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-continue-shopping.tsx.
 */

export function CartContinueShopping() {
  const { close, labels } = useCartDrawer()

  return (
    <div className="flex justify-center px-5 pb-3">
      <button
        type="button"
        onClick={close}
        className="text-sm text-text-muted hover:text-text-base underline underline-offset-4 decoration-border hover:decoration-text-muted transition-colors"
      >
        {labels.continueShopping}
      </button>
    </div>
  )
}
