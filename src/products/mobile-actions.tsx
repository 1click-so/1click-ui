"use client"

import type { HttpTypes } from "@medusajs/types"
import React, { useMemo } from "react"
import { ChevronDown, X } from "lucide-react"

import { cn } from "../lib/utils"
import { getProductPrice } from "../lib/get-product-price"
import { isSimpleProduct } from "../lib/product"
import useToggleState from "../lib/hooks/use-toggle-state"
import { Button } from "../primitives/ui/button"
import { useProductLabels } from "./context"
import { OptionSelect } from "./option-select"

type MobileActionsProps = {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  options: Record<string, string | undefined>
  updateOptions: (optionId: string, value: string) => void
  inStock?: boolean
  handleAddToCart: () => void
  isAdding?: boolean
  show: boolean
  optionsDisabled: boolean
}

const MobileActions: React.FC<MobileActionsProps> = ({
  product,
  variant,
  options,
  updateOptions,
  inStock,
  handleAddToCart,
  isAdding,
  show,
  optionsDisabled,
}) => {
  const labels = useProductLabels()
  const { state, open, close } = useToggleState()

  const price = getProductPrice({
    product,
    variantId: variant?.id,
  })

  const selectedPrice = useMemo(() => {
    if (!price) return null
    const { variantPrice, cheapestPrice } = price
    return variantPrice || cheapestPrice || null
  }, [price])

  const isSimple = isSimpleProduct(product)

  return (
    <>
      <div
        className={cn("lg:hidden inset-x-0 bottom-0 fixed z-50", {
          "pointer-events-none": !show,
        })}
      >
        <div
          className={cn(
            "bg-surface flex flex-col gap-y-3 justify-center items-center p-4 h-full w-full border-t border-border transition-all duration-300",
            show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full"
          )}
          data-testid="mobile-actions"
        >
          <div className="flex items-center gap-x-2">
            <span className="text-text-base" data-testid="mobile-title">
              {product.title}
            </span>
            <span className="text-text-subtle">—</span>
            {selectedPrice ? (
              <div className="flex items-end gap-x-2 text-text-base">
                {selectedPrice.price_type === "sale" && (
                  <span className="line-through text-sm text-text-muted">
                    {selectedPrice.original_price}
                  </span>
                )}
                <span
                  className={cn({
                    "text-accent": selectedPrice.price_type === "sale",
                  })}
                >
                  {selectedPrice.calculated_price}
                </span>
              </div>
            ) : (
              <div />
            )}
          </div>
          <div
            className={cn("grid w-full gap-x-4", {
              "grid-cols-2": !isSimple,
              "grid-cols-1": isSimple,
            })}
          >
            {!isSimple && (
              <Button
                onClick={open}
                variant="outline"
                className="w-full"
                data-testid="mobile-actions-button"
              >
                <div className="flex items-center justify-between w-full">
                  <span>
                    {variant
                      ? Object.values(options).join(" / ")
                      : labels.selectVariant}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </Button>
            )}
            <Button
              onClick={handleAddToCart}
              disabled={!inStock || !variant}
              className="w-full"
              data-testid="mobile-cart-button"
            >
              {isAdding
                ? "..."
                : !variant
                  ? labels.selectVariant
                  : !inStock
                    ? labels.outOfStock
                    : labels.addToCart}
            </Button>
          </div>
        </div>
      </div>

      {state && (
        <div className="fixed inset-0 z-[75]">
          <div
            className="fixed inset-0 bg-text-base/75 backdrop-blur-sm"
            onClick={close}
          />
          <div className="fixed bottom-0 inset-x-0">
            <div className="w-full flex justify-end pr-6 mb-4">
              <button
                onClick={close}
                className="bg-surface w-12 h-12 rounded-full text-text-base flex justify-center items-center"
                data-testid="close-modal-button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-surface px-6 py-12 rounded-t-2xl">
              {(product.variants?.length ?? 0) > 1 && (
                <div className="flex flex-col gap-y-6">
                  {(product.options || []).map((option) => (
                    <div key={option.id}>
                      <OptionSelect
                        option={option}
                        current={options[option.id]}
                        updateOption={updateOptions}
                        title={option.title ?? ""}
                        disabled={optionsDisabled}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export { MobileActions, type MobileActionsProps }
