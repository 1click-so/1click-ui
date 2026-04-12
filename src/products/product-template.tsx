import React, { Suspense } from "react"
import type { HttpTypes } from "@medusajs/types"
import { notFound } from "next/navigation"

import { ImageGallery } from "./image-gallery"
import { ProductActions } from "./product-actions"
import { ProductTabs } from "./product-tabs"
import { RelatedProducts } from "./related-products"
import { ProductInfo } from "./product-info"
import { ProductActionsWrapper } from "./product-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  onAddToCart?: (product: HttpTypes.StoreProduct, variant: HttpTypes.StoreProductVariant) => void
}

export function ProductTemplate({
  product,
  region,
  countryCode,
  onAddToCart,
}: ProductTemplateProps) {
  if (!product || !product.id) {
    return notFound()
  }

  const images = product.images ?? []

  return (
    <>
      <div
        className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row sm:items-start py-6 relative"
        data-testid="product-container"
      >
        <div className="flex flex-col sm:sticky sm:top-48 sm:py-0 sm:max-w-[300px] w-full py-8 gap-y-6">
          <ProductInfo product={product} />
          <ProductTabs product={product} />
        </div>
        <div className="block w-full relative">
          <ImageGallery images={images} />
        </div>
        <div className="flex flex-col sm:sticky sm:top-48 sm:py-0 sm:max-w-[300px] w-full py-8 gap-y-12">
          <Suspense
            fallback={
              <ProductActions
                disabled={true}
                product={product}
                onAddToCart={onAddToCart}
              />
            }
          >
            <ProductActionsWrapper
              id={product.id}
              region={region}
              onAddToCart={onAddToCart}
            />
          </Suspense>
        </div>
      </div>
      <div
        className="max-w-7xl mx-auto px-4 my-16 sm:my-32"
        data-testid="related-products-container"
      >
        <Suspense
          fallback={
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[9/16] bg-surface-muted animate-pulse rounded-lg"
                />
              ))}
            </div>
          }
        >
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </>
  )
}

export { type ProductTemplateProps }
