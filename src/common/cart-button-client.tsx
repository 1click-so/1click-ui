"use client"

import type { HttpTypes } from "@medusajs/types"
import { ShoppingBag } from "lucide-react"
import { useCartDrawer } from "../cart-drawer/context"

export function CartButtonClient({
  cart,
}: {
  cart: HttpTypes.StoreCart | null
}) {
  const { open } = useCartDrawer()
  const totalItems =
    cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0

  return (
    <button
      onClick={open}
      className="flex items-center gap-1.5 hover:text-text-base transition-colors relative"
      data-testid="nav-cart-link"
    >
      <ShoppingBag className="w-5 h-5" />
      {totalItems > 0 && (
        <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] bg-text-base text-surface text-[10px] font-semibold rounded-full flex items-center justify-center px-1">
          {totalItems}
        </span>
      )}
    </button>
  )
}
