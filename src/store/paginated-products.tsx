import type { ComponentType } from "react"
import type { HttpTypes } from "@medusajs/types"
import { listProductsWithSort } from "../data/products"
import { getRegion } from "../data/regions"
import type { SortOptions } from "../lib/sort-products"
import { ProductPreview } from "../products/product-preview"
import { Pagination } from "./pagination"

/** A component that renders a single product card. */
export type ProductCardComponent = ComponentType<{
  product: HttpTypes.StoreProduct
}>

const PRODUCT_LIMIT = 12

export async function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  categoryId,
  productsIds,
  countryCode,
  renderProduct: Card = ProductPreview,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryId?: string
  productsIds?: string[]
  countryCode: string
  /** Override the default ProductPreview with a store-specific card. */
  renderProduct?: ProductCardComponent
}) {
  const queryParams: HttpTypes.FindParams &
    HttpTypes.StoreProductListParams & { order?: string } = {
    limit: PRODUCT_LIMIT,
  }

  if (collectionId) queryParams.collection_id = [collectionId]
  if (categoryId) queryParams.category_id = [categoryId]
  if (productsIds) queryParams.id = productsIds
  if (sortBy === "created_at") queryParams.order = "created_at"

  const region = await getRegion(countryCode)
  if (!region) return null

  const {
    response: { products, count },
  } = await listProductsWithSort({
    page,
    queryParams,
    sortBy,
    countryCode,
  })

  const totalPages = Math.ceil(count / PRODUCT_LIMIT)

  return (
    <>
      <ul
        className="grid grid-cols-2 w-full sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8"
        data-testid="products-list"
      >
        {products.map((p) => (
          <li key={p.id}>
            <Card product={p} />
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <Pagination
          data-testid="product-pagination"
          page={page}
          totalPages={totalPages}
        />
      )}
    </>
  )
}
