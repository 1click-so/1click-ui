import { Suspense } from "react"
import { notFound } from "next/navigation"
import type { HttpTypes } from "@medusajs/types"
import type { SortOptions } from "../lib/sort-products"
import type { StoreLabels } from "./labels"
import LocalizedLink from "../common/localized-link"
import { SortSelect } from "./sort-select"
import { PaginatedProducts } from "./paginated-products"
import { SkeletonProductGrid } from "./skeleton-product-grid"

type CategoryTemplateProps = {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
  labels?: StoreLabels
}

export function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
  labels,
}: CategoryTemplateProps) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  const parents: HttpTypes.StoreProductCategory[] = []
  const getParents = (cat: HttpTypes.StoreProductCategory) => {
    if (cat.parent_category) {
      parents.push(cat.parent_category)
      getParents(cat.parent_category)
    }
  }
  getParents(category)

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-start py-6 max-w-7xl mx-auto px-4"
      data-testid="category-container"
    >
      <div className="flex sm:flex-col gap-12 py-4 mb-8 sm:px-0 pl-6 sm:min-w-[250px]">
        <SortSelect
          sortBy={sort}
          labels={labels}
          data-testid="sort-by-container"
        />
      </div>
      <div className="w-full">
        <div className="flex flex-row mb-8 gap-4">
          {parents.map((parent) => (
            <span key={parent.id} className="text-muted-foreground text-2xl">
              <LocalizedLink
                className="mr-4 hover:text-foreground"
                href={`/categories/${parent.handle}`}
              >
                {parent.name}
              </LocalizedLink>
              /
            </span>
          ))}
          <h1
            className="text-2xl font-semibold text-foreground"
            data-testid="category-page-title"
          >
            {category.name}
          </h1>
        </div>
        {category.description && (
          <div className="mb-8 text-sm text-muted-foreground">
            <p>{category.description}</p>
          </div>
        )}
        {category.category_children && (
          <div className="mb-8">
            <ul className="grid grid-cols-1 gap-2">
              {category.category_children.map((c) => (
                <li key={c.id}>
                  <LocalizedLink
                    href={`/categories/${c.handle}`}
                    className="text-primary hover:underline"
                  >
                    {c.name}
                  </LocalizedLink>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Suspense
          fallback={
            <SkeletonProductGrid
              numberOfProducts={category.products?.length ?? 8}
            />
          }
        >
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            categoryId={category.id}
            countryCode={countryCode}
          />
        </Suspense>
      </div>
    </div>
  )
}

export { type CategoryTemplateProps }
