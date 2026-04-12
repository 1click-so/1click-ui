import type { HttpTypes } from "@medusajs/types"
import Image from "next/image"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  return (
    <div className="flex items-start relative">
      <div className="flex flex-col flex-1 sm:mx-16 gap-y-4">
        {images.map((image, index) => (
          <div
            key={image.id}
            className="relative aspect-[29/34] w-full overflow-hidden bg-surface-muted rounded-lg"
            id={image.id}
          >
            {!!image.url && (
              <Image
                src={image.url}
                priority={index <= 2}
                className="absolute inset-0 rounded-lg"
                alt={`Product image ${index + 1}`}
                fill
                sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
                style={{ objectFit: "cover" }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export { ImageGallery, type ImageGalleryProps }
