"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, usePathname } from "next/navigation"
import type { HttpTypes } from "@medusajs/types"
import { updateRegion } from "../data/cart"

type CountryOption = {
  country: string
  region: string
  label: string
}

type CountrySelectProps = {
  regions: HttpTypes.StoreRegion[]
  className?: string
}

export function CountrySelect({ regions, className }: CountrySelectProps) {
  const { countryCode } = useParams()
  const currentPath = usePathname().split(`/${countryCode}`)[1] || ""

  const options = useMemo(() => {
    return regions
      .flatMap((r) =>
        (r.countries ?? []).map((c) => ({
          country: c.iso_2,
          region: r.id,
          label: c.display_name,
        }))
      )
      .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""))
  }, [regions])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = options.find((o) => o.country === e.target.value)
    if (selected) {
      if (selected.country) updateRegion(selected.country, currentPath)
    }
  }

  return (
    <select
      value={(countryCode as string) || ""}
      onChange={handleChange}
      className={className ?? "text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2"}
    >
      {options.map((o) => (
        <option key={o.country} value={o.country}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export { type CountrySelectProps }
