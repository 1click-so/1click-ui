"use client"

import { defaultOrderLabels, type OrderLabels } from "./labels"

type OrderTimelineProps = {
  fulfillmentStatus?: string
  labels?: Pick<OrderLabels, "orderPlaced" | "processing" | "shipped" | "delivered">
}

export function OrderTimeline({
  fulfillmentStatus,
  labels,
}: OrderTimelineProps) {
  const l = { ...defaultOrderLabels, ...labels }

  const steps = [
    { label: l.orderPlaced, key: "placed" },
    { label: l.processing, key: "processing" },
    { label: l.shipped, key: "shipped" },
    { label: l.delivered, key: "delivered" },
  ]

  const getActiveIndex = (): number => {
    switch (fulfillmentStatus) {
      case "delivered":
      case "partially_delivered":
        return 3
      case "shipped":
      case "partially_shipped":
        return 2
      case "fulfilled":
      case "partially_fulfilled":
        return 1
      default:
        return 0
    }
  }

  const activeIndex = getActiveIndex()
  const lastStep = steps.length - 1

  return (
    <div className="px-6 py-5 bg-surface rounded-xl shadow-sm">
      <div className="relative">
        <div className="absolute top-[5px] left-[6px] right-[6px] h-[2px] bg-surface-muted rounded-full" />
        <div
          className="absolute top-[5px] left-[6px] h-[2px] bg-success rounded-full transition-all duration-700 ease-out"
          style={{
            width:
              activeIndex === 0
                ? "0"
                : `calc((100% - 12px) * ${activeIndex / lastStep})`,
          }}
        />

        <div className="relative flex justify-between">
          {steps.map((step, i) => {
            const isActive = i === activeIndex
            const isComplete = i < activeIndex
            const isFuture = i > activeIndex

            return (
              <div
                key={step.key}
                className={`flex flex-col gap-2 ${
                  i === 0
                    ? "items-start"
                    : i === lastStep
                      ? "items-end"
                      : "items-center"
                }`}
              >
                <div className="relative w-3 h-3">
                  {isActive && (
                    <span className="absolute inset-0 rounded-full bg-success/40 animate-ping [animation-duration:2s]" />
                  )}
                  <div
                    className={`relative w-3 h-3 rounded-full z-10 ${
                      isComplete || isActive ? "bg-success" : "bg-surface-muted"
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] sm:text-xs font-medium whitespace-nowrap ${
                    isFuture ? "text-text-subtle" : "text-success"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { type OrderTimelineProps }
