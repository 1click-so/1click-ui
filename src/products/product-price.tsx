"use client"

import type { HttpTypes } from "@medusajs/types"
import { cn } from "../lib/utils"
import { getProductPrice } from "../lib/get-product-price"
import { useProductLabels } from "./context"

export function ProductPrice({
  product,
  variant,
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
}) {
  const labels = useProductLabels()
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  })

  const selectedPrice = variant ? variantPrice : cheapestPrice

  if (!selectedPrice) {
    return <div className="block w-32 h-9 bg-muted animate-pulse rounded" />
  }

  return (
    <div className="flex flex-col text-foreground">
      <span
        className={cn("text-xl font-semibold", {
          "text-primary": selectedPrice.price_type === "sale",
        })}
      >
        {!variant && `${labels.from} `}
        <span
          data-testid="product-price"
          data-value={selectedPrice.calculated_price_number}
        >
          {selectedPrice.calculated_price}
        </span>
      </span>
      {selectedPrice.price_type === "sale" && (
        <>
          <p>
            <span className="text-muted-foreground">{labels.original} </span>
            <span
              className="line-through"
              data-testid="original-product-price"
              data-value={selectedPrice.original_price_number}
            >
              {selectedPrice.original_price}
            </span>
          </p>
          <span className="text-primary">
            -{selectedPrice.percentage_diff}%
          </span>
        </>
      )}
    </div>
  )
}
