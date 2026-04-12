import { cn } from "../lib/utils"
import type { VariantPrice } from "../lib/get-product-price"

export function PreviewPrice({ price }: { price: VariantPrice }) {
  if (!price) {
    return null
  }

  return (
    <>
      {price.price_type === "sale" && (
        <span
          className="line-through text-text-muted text-sm"
          data-testid="original-price"
        >
          {price.original_price}
        </span>
      )}
      <span
        className={cn("text-text-muted text-sm", {
          "text-accent": price.price_type === "sale",
        })}
        data-testid="price"
      >
        {price.calculated_price}
      </span>
    </>
  )
}
