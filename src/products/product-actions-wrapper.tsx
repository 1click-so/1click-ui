import type { HttpTypes } from "@medusajs/types"
import { listProducts } from "../data/products"
import { ProductActions } from "./product-actions"

type ProductActionsWrapperProps = {
  id: string
  region: HttpTypes.StoreRegion
  onAddToCart?: (product: HttpTypes.StoreProduct, variant: HttpTypes.StoreProductVariant) => void
}

export async function ProductActionsWrapper({
  id,
  region,
  onAddToCart,
}: ProductActionsWrapperProps) {
  const product = await listProducts({
    queryParams: { id: [id] },
    regionId: region.id,
  }).then(({ response }) => response.products[0])

  if (!product) return null

  return <ProductActions product={product} onAddToCart={onAddToCart} />
}

export { type ProductActionsWrapperProps }
