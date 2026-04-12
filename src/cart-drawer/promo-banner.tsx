"use client"

import { cn } from "../lib/utils"

/**
 * Cart drawer promo banner — tiny top bar with a message and a variant.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-promo-banner.tsx.
 */

type CartPromoBannerProps = {
  message: string
  variant?: "info" | "success" | "warning"
  className?: string
}

const variantStyles = {
  info: "bg-foreground text-card",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
}

export function CartPromoBanner({
  message,
  variant = "warning",
  className,
}: CartPromoBannerProps) {
  if (!message) return null

  return (
    <div
      className={cn(
        "px-6 py-2.5 text-[13px] font-medium flex-shrink-0 text-center",
        variantStyles[variant],
        className
      )}
    >
      {message}
    </div>
  )
}
