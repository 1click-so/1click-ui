import type { HttpTypes } from "@medusajs/types"

export type SortOptions = "price_asc" | "price_desc" | "created_at"

interface MinPricedProduct extends HttpTypes.StoreProduct {
  _minPrice?: number
}

export function sortProducts(
  products: HttpTypes.StoreProduct[],
  sortBy: SortOptions
): HttpTypes.StoreProduct[] {
  const sortedProducts = [...products] as MinPricedProduct[]

  if (["price_asc", "price_desc"].includes(sortBy)) {
    sortedProducts.forEach((product) => {
      if (product.variants && product.variants.length > 0) {
        product._minPrice = Math.min(
          ...product.variants.map(
            (variant) =>
              (variant as any)?.calculated_price?.calculated_amount || 0
          )
        )
      } else {
        product._minPrice = Infinity
      }
    })

    sortedProducts.sort((a, b) => {
      const diff = (a._minPrice ?? 0) - (b._minPrice ?? 0)
      return sortBy === "price_asc" ? diff : -diff
    })
  }

  if (sortBy === "created_at") {
    sortedProducts.sort((a, b) => {
      return (
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
      )
    })
  }

  return sortedProducts
}
