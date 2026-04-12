import Image from "next/image"
import type { HttpTypes } from "@medusajs/types"
import { ImageOff } from "lucide-react"
import { DualPrice } from "../lib/dual-price"
import { defaultOrderLabels, type OrderLabels } from "./labels"

type OrderItemProps = {
  item: HttpTypes.StoreOrderLineItem
  currencyCode: string
  labels?: Pick<OrderLabels, "qty">
}

export function OrderItem({ item, currencyCode, labels }: OrderItemProps) {
  const l = { ...defaultOrderLabels, ...labels }
  const hasDiscount = item.total < item.original_total

  const variantLabel = (() => {
    const options = (item as any).variant?.options
    if (options?.length) {
      return options.map((opt: any) => opt.value).join(" / ")
    }
    const title = (item as any).variant?.title
    if (title && title !== "Default variant") return title
    return null
  })()

  return (
    <div className="flex gap-4 py-4">
      <div className="w-[64px] h-[64px] rounded-xl overflow-hidden bg-muted relative flex-shrink-0 shadow-sm">
        {item.thumbnail ? (
          <Image
            src={item.thumbnail}
            alt={item.product_title || ""}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-semibold text-foreground line-clamp-1 leading-snug block">
              {item.product_title}
            </span>
            {variantLabel && (
              <span className="text-xs text-muted-foreground mt-0.5 block">
                {variantLabel}
              </span>
            )}
            <span className="text-xs text-muted-foreground mt-0.5 block">
              {item.quantity} {l.qty}
            </span>
          </div>
          <div className="text-right flex-shrink-0">
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through block leading-none mb-0.5">
                <DualPrice
                  amount={item.original_total}
                  currencyCode={currencyCode}
                  className="text-xs text-muted-foreground"
                />
              </span>
            )}
            <DualPrice
              amount={item.total}
              currencyCode={currencyCode}
              className={`text-sm font-bold ${
                hasDiscount ? "text-success" : "text-foreground"
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export { type OrderItemProps }
