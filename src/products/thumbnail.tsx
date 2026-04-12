import Image from "next/image"
import React from "react"
import { ImageOff } from "lucide-react"

import { cn } from "../lib/utils"

type ThumbnailProps = {
  thumbnail?: string | null
  images?: { url: string }[] | null
  size?: "small" | "medium" | "large" | "full" | "square"
  isFeatured?: boolean
  className?: string
  "data-testid"?: string
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  size = "small",
  isFeatured,
  className,
  "data-testid": dataTestid,
}) => {
  const initialImage = thumbnail || images?.[0]?.url

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden p-4 bg-surface-muted rounded-lg group-hover:shadow-md transition-shadow ease-in-out duration-150",
        {
          "aspect-[11/14]": isFeatured,
          "aspect-[9/16]": !isFeatured && size !== "square",
          "aspect-[1/1]": size === "square",
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        },
        className
      )}
      data-testid={dataTestid}
    >
      {initialImage ? (
        <Image
          src={initialImage}
          alt="Thumbnail"
          className="absolute inset-0 object-cover object-center"
          draggable={false}
          quality={50}
          sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
          fill
        />
      ) : (
        <div className="w-full h-full absolute inset-0 flex items-center justify-center">
          <ImageOff
            className="text-text-subtle"
            size={size === "small" ? 16 : 24}
          />
        </div>
      )}
    </div>
  )
}

export { Thumbnail, type ThumbnailProps }
