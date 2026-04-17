import type { ComponentType } from "react"
import type { HttpTypes } from "@medusajs/types"
import { listProducts } from "../data/products"
import { getRegion } from "../data/regions"
import { ProductPreview } from "./product-preview"
import { defaultProductLabels, type ProductLabels } from "./labels"

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
  labels?: Pick<ProductLabels, "relatedProducts" | "relatedProductsDescription">
  /** Override the default ProductPreview with a store-specific card. */
  renderProduct?: ComponentType<{ product: HttpTypes.StoreProduct }>
}

export async function RelatedProducts({
  product,
  countryCode,
  labels,
  renderProduct: Card = ProductPreview,
}: RelatedProductsProps) {
  const l = { ...defaultProductLabels, ...labels }
  const region = await getRegion(countryCode)

  if (!region) return null

  const queryParams: HttpTypes.StoreProductListParams = {}
  if (region.id) queryParams.region_id = region.id
  if (product.collection_id) queryParams.collection_id = [product.collection_id]
  if (product.tags) {
    queryParams.tag_id = product.tags
      .map((t) => t.id)
      .filter(Boolean) as string[]
  }
  queryParams.is_giftcard = false

  const products = await listProducts({
    queryParams,
    countryCode,
  }).then(({ response }) =>
    response.products.filter((p) => p.id !== product.id)
  )

  if (!products.length) return null

  return (
    <div>
      <div className="flex flex-col items-center text-center mb-16">
        <span className="text-sm text-muted-foreground mb-6">
          {l.relatedProducts}
        </span>
        <p className="text-2xl text-foreground max-w-lg">
          {l.relatedProductsDescription}
        </p>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8">
        {products.map((p) => (
          <li key={p.id}>
            <Card product={p} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export { type RelatedProductsProps }
