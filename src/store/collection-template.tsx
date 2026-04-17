import { Suspense } from "react"
import type { HttpTypes } from "@medusajs/types"
import type { SortOptions } from "../lib/sort-products"
import type { StoreLabels } from "./labels"
import { SortSelect } from "./sort-select"
import { PaginatedProducts, type ProductCardComponent } from "./paginated-products"
import { SkeletonProductGrid } from "./skeleton-product-grid"

type CollectionTemplateProps = {
  sortBy?: SortOptions
  collection: HttpTypes.StoreCollection
  page?: string
  countryCode: string
  labels?: StoreLabels
  /** Override the default ProductPreview with a store-specific card. */
  renderProduct?: ProductCardComponent
}

export function CollectionTemplate({
  sortBy,
  collection,
  page,
  countryCode,
  labels,
  renderProduct,
}: CollectionTemplateProps) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <div className="flex flex-col sm:flex-row sm:items-start py-6 max-w-7xl mx-auto px-4">
      <div className="flex sm:flex-col gap-12 py-4 mb-8 sm:px-0 pl-6 sm:min-w-[250px]">
        <SortSelect sortBy={sort} labels={labels} />
      </div>
      <div className="w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            {collection.title}
          </h1>
        </div>
        <Suspense
          fallback={
            <SkeletonProductGrid
              numberOfProducts={collection.products?.length}
            />
          }
        >
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            collectionId={collection.id}
            countryCode={countryCode}
            renderProduct={renderProduct}
          />
        </Suspense>
      </div>
    </div>
  )
}

export { type CollectionTemplateProps }
