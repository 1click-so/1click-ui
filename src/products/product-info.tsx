import type { HttpTypes } from "@medusajs/types"
import Link from "next/link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

export function ProductInfo({ product }: ProductInfoProps) {
  return (
    <div id="product-info">
      <div className="flex flex-col gap-y-4 lg:max-w-[500px] mx-auto">
        {product.collection && (
          <Link
            href={`/collections/${product.collection.handle}`}
            className="text-sm text-muted-foreground hover:text-muted-foreground"
          >
            {product.collection.title}
          </Link>
        )}
        <h2
          className="text-3xl leading-10 text-foreground font-bold"
          data-testid="product-title"
        >
          {product.title}
        </h2>
        <p
          className="text-sm text-muted-foreground whitespace-pre-line"
          data-testid="product-description"
        >
          {product.description}
        </p>
      </div>
    </div>
  )
}

export { type ProductInfoProps }
