import type { HttpTypes } from "@medusajs/types"
import LocalizedLink from "../common/localized-link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

export function ProductInfo({ product }: ProductInfoProps) {
  return (
    <div id="product-info">
      <div className="flex flex-col gap-y-4 lg:max-w-[500px] mx-auto">
        {product.collection && (
          <LocalizedLink
            href={`/collections/${product.collection.handle}`}
            className="text-sm text-text-muted hover:text-text-subtle"
          >
            {product.collection.title}
          </LocalizedLink>
        )}
        <h2
          className="text-3xl leading-10 text-text-base font-bold"
          data-testid="product-title"
        >
          {product.title}
        </h2>
        <p
          className="text-sm text-text-subtle whitespace-pre-line"
          data-testid="product-description"
        >
          {product.description}
        </p>
      </div>
    </div>
  )
}

export { type ProductInfoProps }
