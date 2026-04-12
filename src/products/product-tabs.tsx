"use client"

import type { HttpTypes } from "@medusajs/types"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { Truck, RefreshCw, Undo2 } from "lucide-react"

import { cn } from "../lib/utils"
import { useProductLabels } from "./context"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

export function ProductTabs({ product }: ProductTabsProps) {
  const labels = useProductLabels()

  const tabs = [
    {
      label: labels.productInformation,
      component: <ProductInfoTab product={product} />,
    },
    {
      label: labels.shippingAndReturns,
      component: <ShippingInfoTab />,
    },
  ]

  return (
    <div className="w-full">
      <AccordionPrimitive.Root type="multiple">
        {tabs.map((tab, i) => (
          <AccordionPrimitive.Item
            key={i}
            value={tab.label}
            className="border-t border-border py-3 last:border-b"
          >
            <AccordionPrimitive.Header className="px-1">
              <div className="flex w-full items-center justify-between">
                <span className="text-text-subtle text-sm">{tab.label}</span>
                <AccordionPrimitive.Trigger>
                  <MorphingTrigger />
                </AccordionPrimitive.Trigger>
              </div>
            </AccordionPrimitive.Header>
            <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down px-1">
              <div className="w-full">{tab.component}</div>
            </AccordionPrimitive.Content>
          </AccordionPrimitive.Item>
        ))}
      </AccordionPrimitive.Root>
    </div>
  )
}

function ProductInfoTab({ product }: ProductTabsProps) {
  const labels = useProductLabels()

  return (
    <div className="text-sm py-8">
      <div className="grid grid-cols-2 gap-x-8">
        <div className="flex flex-col gap-y-4">
          <div>
            <span className="font-semibold text-text-base">
              {labels.material}
            </span>
            <p className="text-text-muted">
              {product.material ? product.material : "-"}
            </p>
          </div>
          <div>
            <span className="font-semibold text-text-base">
              {labels.countryOfOrigin}
            </span>
            <p className="text-text-muted">
              {product.origin_country ? product.origin_country : "-"}
            </p>
          </div>
          <div>
            <span className="font-semibold text-text-base">{labels.type}</span>
            <p className="text-text-muted">
              {product.type ? product.type.value : "-"}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-y-4">
          <div>
            <span className="font-semibold text-text-base">
              {labels.weight}
            </span>
            <p className="text-text-muted">
              {product.weight ? `${product.weight} g` : "-"}
            </p>
          </div>
          <div>
            <span className="font-semibold text-text-base">
              {labels.dimensions}
            </span>
            <p className="text-text-muted">
              {product.length && product.width && product.height
                ? `${product.length}L x ${product.width}W x ${product.height}H`
                : "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShippingInfoTab() {
  const labels = useProductLabels()

  return (
    <div className="text-sm py-8">
      <div className="grid grid-cols-1 gap-y-8">
        <div className="flex items-start gap-x-2">
          <Truck className="w-5 h-5 text-text-subtle flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-text-base">
              {labels.fastDelivery}
            </span>
            <p className="max-w-sm text-text-muted">
              {labels.fastDeliveryDescription}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <RefreshCw className="w-5 h-5 text-text-subtle flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-text-base">
              {labels.simpleExchanges}
            </span>
            <p className="max-w-sm text-text-muted">
              {labels.simpleExchangesDescription}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Undo2 className="w-5 h-5 text-text-subtle flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-text-base">
              {labels.easyReturns}
            </span>
            <p className="max-w-sm text-text-muted">
              {labels.easyReturnsDescription}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MorphingTrigger() {
  return (
    <div className="text-text-subtle hover:bg-surface-muted rounded-lg relative p-1.5">
      <div className="h-5 w-5">
        <span className="bg-text-subtle rounded-full absolute inset-y-[31.75%] left-[48%] right-1/2 w-[1.5px] transition-transform duration-300 group-data-[state=open]:rotate-90" />
        <span className="bg-text-subtle rounded-full absolute inset-x-[31.75%] top-[48%] bottom-1/2 h-[1.5px] transition-transform duration-300 group-data-[state=open]:rotate-90 group-data-[state=open]:left-1/2 group-data-[state=open]:right-1/2" />
      </div>
    </div>
  )
}
