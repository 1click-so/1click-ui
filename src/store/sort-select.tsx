"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { cn } from "../lib/utils"
import type { SortOptions } from "../lib/sort-products"
import { defaultStoreLabels, type StoreLabels } from "./labels"

type SortSelectProps = {
  sortBy: SortOptions
  labels?: Pick<StoreLabels, "sortBy" | "latestArrivals" | "priceLowToHigh" | "priceHighToLow">
  "data-testid"?: string
}

export function SortSelect({
  sortBy,
  labels,
  "data-testid": dataTestId,
}: SortSelectProps) {
  const l = { ...defaultStoreLabels, ...labels }
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const sortOptions: { value: SortOptions; label: string }[] = [
    { value: "created_at", label: l.latestArrivals },
    { value: "price_asc", label: l.priceLowToHigh },
    { value: "price_desc", label: l.priceHighToLow },
  ]

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)
      return params.toString()
    },
    [searchParams]
  )

  const handleChange = (value: SortOptions) => {
    const query = createQueryString("sortBy", value)
    router.push(`${pathname}?${query}`)
  }

  return (
    <div className="flex flex-col gap-y-3" data-testid={dataTestId}>
      <span className="text-sm font-medium text-muted-foreground">{l.sortBy}</span>
      <div className="flex flex-col gap-y-1">
        {sortOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => handleChange(option.value)}
            className={cn(
              "text-sm text-left px-2 py-1.5 rounded-md transition-colors",
              option.value === sortBy
                ? "text-foreground font-medium bg-muted"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export { type SortSelectProps }
