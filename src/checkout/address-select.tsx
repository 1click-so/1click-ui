"use client"

import type { HttpTypes } from "@medusajs/types"
import { useMemo } from "react"

import compareAddresses from "../data/util/compare-addresses"
import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"

/**
 * AddressSelect — native `<select>` dropdown for picking a saved customer
 * address. Rewritten from the mindpages Headless UI Listbox variant to
 * use a plain HTML select so the library has zero dependency on
 * @headlessui/react. Stores that want the fancier Listbox UX can easily
 * replace this one file locally.
 *
 * Extracted from mindpages-storefront
 * src/modules/checkout/components/address-select/index.tsx.
 */

type AddressSelectProps = {
  addresses: HttpTypes.StoreCustomerAddress[]
  addressInput: HttpTypes.StoreCartAddress | null
  onSelect: (address: HttpTypes.StoreCartAddress | undefined, email?: string) => void
}

export function AddressSelect({
  addresses,
  addressInput,
  onSelect,
}: AddressSelectProps) {
  const labels = useCheckoutLabels()

  const selectedId = useMemo(() => {
    const match = addresses.find((a) =>
      compareAddresses(
        a as unknown as Record<string, unknown>,
        addressInput as unknown as Record<string, unknown>
      )
    )
    return match?.id ?? ""
  }, [addresses, addressInput])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    const picked = addresses.find((a) => a.id === id)
    if (picked) onSelect(picked as HttpTypes.StoreCartAddress)
  }

  const formatAddress = (a: HttpTypes.StoreCustomerAddress): string => {
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ")
    const loc = [a.address_1, a.city, a.country_code?.toUpperCase()]
      .filter(Boolean)
      .join(", ")
    return `${name} — ${loc}`
  }

  return (
    <select
      value={selectedId}
      onChange={handleChange}
      className={cn(
        "w-full px-4 py-[10px] text-sm text-left bg-surface border border-border rounded-lg",
        "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      )}
      data-testid="shipping-address-select"
    >
      <option value="">{labels.chooseAddress}</option>
      {addresses.map((address) => (
        <option key={address.id} value={address.id}>
          {formatAddress(address)}
        </option>
      ))}
    </select>
  )
}
