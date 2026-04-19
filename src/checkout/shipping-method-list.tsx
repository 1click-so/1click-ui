"use client"

import type { HttpTypes } from "@medusajs/types"

import { DualPrice } from "../lib/dual-price"
import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"
import {
  EcontOfficeSelector,
  type EcontOffice,
} from "./econt-office-selector"
import {
  BoxNowLockerSelector,
  type BoxNowLocker,
} from "./boxnow-locker-selector"
import { ErrorMessage } from "./error-message"

/**
 * CheckoutShippingMethodList — radio-style list of shipping options.
 * When the user selects an Econt office option, the office selector
 * expands inline inside that row.
 *
 * Detecting "is this an Econt office option" is name-based today (matches
 * the mindpages behavior). The detection keywords are exposed via the
 * `detectEcontOption` prop so stores can override or disable Econt-specific
 * rendering.
 *
 * Presentational — state + handlers come from parent CheckoutClient.
 *
 * Extracted from mindpages-storefront checkout-client/index.tsx — the
 * `Начин на доставка` section (roughly lines 888-1008).
 */

type CheckoutShippingMethodListProps = {
  shippingMethods: HttpTypes.StoreCartShippingOption[]
  selectedShippingMethodId: string | null
  calculatedPricesMap: Record<string, number>
  isLoadingPrices: boolean
  shippingLoading: boolean
  shippingError: string | null
  onSelect: (id: string) => void
  addressReady: boolean
  currencyCode: string
  /** Optional: Econt office state + handler for inline-expand rows */
  econt?: {
    detect?: (option: HttpTypes.StoreCartShippingOption) => boolean
    selectedOffice: EcontOffice | null
    onSelectOffice: (office: EcontOffice | null) => void
    userCity: string
    userAddress: string
  }
  /** Optional: BoxNow locker state + handler for inline-expand rows */
  boxnow?: {
    detect?: (option: HttpTypes.StoreCartShippingOption) => boolean
    selectedLocker: BoxNowLocker | null
    onSelectLocker: (locker: BoxNowLocker | null) => void
    userCity: string
    userAddress: string
  }
  /**
   * Optional per-store carrier branding. Keyed by the stable fulfillment
   * option id (shipping_option.data.id) — "econt-office", "boxnow-locker",
   * etc. If a match is found, a small logo renders between the radio and
   * the option name. Stores that don't supply a map get the unbranded
   * (radio + text only) layout.
   */
  logoByFulfillmentOptionId?: Record<string, { src: string; alt: string }>
}

// Detection uses the stable fulfillment-option id set by the backend
// provider (shipping_option.data.id) — NOT the display name. Admins
// rename options freely, and Bulgarian labels overlap ("До точен
// адрес с ЕКОНТ" contains "еконт" but is address delivery, not office).
const getFulfillmentOptionId = (
  option: HttpTypes.StoreCartShippingOption
): string | null => {
  const data = option.data as { id?: string } | undefined | null
  return typeof data?.id === "string" ? data.id : null
}

const defaultEcontDetect = (option: HttpTypes.StoreCartShippingOption): boolean => {
  return getFulfillmentOptionId(option) === "econt-office"
}

const defaultBoxnowDetect = (option: HttpTypes.StoreCartShippingOption): boolean => {
  return getFulfillmentOptionId(option) === "boxnow-locker"
}

export function CheckoutShippingMethodList({
  shippingMethods,
  selectedShippingMethodId,
  calculatedPricesMap,
  isLoadingPrices,
  shippingLoading,
  shippingError,
  onSelect,
  addressReady,
  currencyCode,
  econt,
  boxnow,
  logoByFulfillmentOptionId,
}: CheckoutShippingMethodListProps) {
  const labels = useCheckoutLabels()
  const detectEcont = econt?.detect ?? defaultEcontDetect
  const detectBoxnow = boxnow?.detect ?? defaultBoxnowDetect

  return (
    <div
      className={cn(
        "mt-8 transition-opacity duration-300",
        !addressReady && "opacity-30 pointer-events-none select-none"
      )}
    >
      <h2 className="text-lg font-semibold text-foreground mb-4 tracking-tight">
        {labels.shippingServices}
      </h2>

      {!addressReady ? (
        <div className="p-4 bg-muted rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">{labels.deliveryDisabled}</p>
        </div>
      ) : shippingMethods.length === 0 ? (
        <div className="p-4 bg-muted rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">{labels.noShippingOptions}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shippingMethods.map((option) => {
            const cantCalc =
              option.price_type === "calculated" &&
              !isLoadingPrices &&
              typeof calculatedPricesMap[option.id] !== "number"
            const selected = option.id === selectedShippingMethodId
            const price =
              option.price_type === "flat"
                ? option.amount
                : calculatedPricesMap[option.id]
            const isFree = price === 0
            const isEcontOffice = econt && detectEcont(option)
            const isBoxnowLocker =
              boxnow && !isEcontOffice && detectBoxnow(option)
            const hasExpanded = selected && (isEcontOffice || isBoxnowLocker)
            const logo = logoByFulfillmentOptionId
              ? logoByFulfillmentOptionId[getFulfillmentOptionId(option) ?? ""]
              : undefined

            return (
              <div
                key={option.id}
                className={cn(
                  "rounded-lg border overflow-hidden transition-colors duration-150",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-muted-foreground"
                )}
              >
                <button
                  type="button"
                  disabled={cantCalc || shippingLoading}
                  onClick={() => onSelect(option.id)}
                  className={cn(
                    "flex items-center w-full px-4 py-3.5 text-left",
                    cantCalc && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <div
                    className={cn(
                      "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mr-3 transition-colors",
                      selected ? "border-primary" : "border-border"
                    )}
                  >
                    {selected && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  {logo && (
                    <span
                      className="relative flex items-center justify-center w-10 h-7 mr-3 flex-shrink-0"
                      aria-hidden="true"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logo.src}
                        alt={logo.alt}
                        className="max-w-full max-h-full object-contain"
                      />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">
                      {option.name}
                    </span>
                    {selected && isEcontOffice && econt?.selectedOffice && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {econt.selectedOffice.name}
                      </p>
                    )}
                    {selected && isBoxnowLocker && boxnow?.selectedLocker && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {boxnow.selectedLocker.title}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold ml-4 flex-shrink-0",
                      isFree ? "text-success" : "text-foreground"
                    )}
                  >
                    {price !== undefined ? (
                      isFree ? (
                        labels.shippingFree
                      ) : (
                        <DualPrice amount={price} currencyCode={currencyCode} />
                      )
                    ) : isLoadingPrices ? (
                      <svg
                        className="animate-spin w-4 h-4 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      "-"
                    )}
                  </span>
                </button>

                {hasExpanded && isEcontOffice && econt && (
                  <EcontOfficeSelector
                    userCity={econt.userCity}
                    userAddress={econt.userAddress}
                    selectedOffice={econt.selectedOffice}
                    onSelect={econt.onSelectOffice}
                  />
                )}

                {hasExpanded && isBoxnowLocker && boxnow && (
                  <BoxNowLockerSelector
                    userCity={boxnow.userCity}
                    userAddress={boxnow.userAddress}
                    selectedLocker={boxnow.selectedLocker}
                    onSelect={boxnow.onSelectLocker}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      <ErrorMessage
        error={shippingError}
        data-testid="delivery-error-message"
      />
    </div>
  )
}
