import type { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "../lib/get-product-price"
import LocalizedLink from "../common/localized-link"
import { Thumbnail } from "./thumbnail"
import { PreviewPrice } from "./preview-price"

type ProductPreviewProps = {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
}

export function ProductPreview({
  product,
  isFeatured,
}: ProductPreviewProps) {
  const { cheapestPrice } = getProductPrice({ product })

  return (
    <LocalizedLink href={`/products/${product.handle}`} className="group">
      <div data-testid="product-wrapper">
        <Thumbnail
          thumbnail={product.thumbnail}
          images={product.images as { url: string }[]}
          size="full"
          isFeatured={isFeatured}
        />
        <div className="flex text-sm mt-4 justify-between">
          <span className="text-muted-foreground" data-testid="product-title">
            {product.title}
          </span>
          <div className="flex items-center gap-x-2">
            {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
          </div>
        </div>
      </div>
    </LocalizedLink>
  )
}

export { type ProductPreviewProps }
