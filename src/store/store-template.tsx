import { Suspense } from "react"
import type { SortOptions } from "../lib/sort-products"
import { defaultStoreLabels, type StoreLabels } from "./labels"
import { SortSelect } from "./sort-select"
import { PaginatedProducts } from "./paginated-products"
import { SkeletonProductGrid } from "./skeleton-product-grid"

type StoreTemplateProps = {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  labels?: StoreLabels
}

export function StoreTemplate({
  sortBy,
  page,
  countryCode,
  labels,
}: StoreTemplateProps) {
  const l = { ...defaultStoreLabels, ...labels }
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <div className="flex flex-col sm:flex-row sm:items-start py-6 max-w-7xl mx-auto px-4">
      <div className="flex sm:flex-col gap-12 py-4 mb-8 sm:px-0 pl-6 sm:min-w-[250px]">
        <SortSelect sortBy={sort} labels={l} />
      </div>
      <div className="w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            {l.allProducts}
          </h1>
        </div>
        <Suspense fallback={<SkeletonProductGrid />}>
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            countryCode={countryCode}
          />
        </Suspense>
      </div>
    </div>
  )
}

export { type StoreTemplateProps }
