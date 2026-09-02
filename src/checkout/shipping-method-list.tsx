"use client"

import type { HttpTypes } from "@medusajs/types"

import { Price } from "../lib/price"
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
import {
  PigeonOfficeSelector,
  type PigeonOffice,
} from "./pigeon-office-selector"
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
  /** Optional: Pigeon Express office state + handler for inline-expand
   * rows. Same contract as `econt` — Pigeon's office delivery works
   * exactly like Econt's, only the office list travels through our
   * backend proxy because Pigeon's catalogue API is credentialed. */
  pigeon?: {
    detect?: (option: HttpTypes.StoreCartShippingOption) => boolean
    selectedOffice: PigeonOffice | null
    onSelectOffice: (office: PigeonOffice | null) => void
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
  /** Show the shipping options as a read-only price PREVIEW before the
   * address is entered, instead of the "enter your address" placeholder.
   * Rows render with their names + (flat) prices + carrier logos but are
   * non-selectable — a hint tells the shopper to enter their address to
   * choose. For flat-priced stores this lets people see the cost up front
   * (a common reason carts stall) without letting them pick a method that
   * needs a city (Econt office / BoxNow locker). Default `false` keeps the
   * classic address-gated placeholder for every existing store. */
  previewWhenAddressNotReady?: boolean
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

const defaultPigeonDetect = (option: HttpTypes.StoreCartShippingOption): boolean => {
  return getFulfillmentOptionId(option) === "pigeon-office"
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
  pigeon,
  logoByFulfillmentOptionId,
  previewWhenAddressNotReady = false,
}: CheckoutShippingMethodListProps) {
  const labels = useCheckoutLabels()
  const detectEcont = econt?.detect ?? defaultEcontDetect
  const detectBoxnow = boxnow?.detect ?? defaultBoxnowDetect
  const detectPigeon = pigeon?.detect ?? defaultPigeonDetect

  // Preview mode: address not filled yet, but the store wants the options
  // shown as a read-only price preview rather than a placeholder. Rows are
  // rendered but locked (no selection) — see `previewWhenAddressNotReady`.
  const showPreview = !addressReady && previewWhenAddressNotReady
  // Only the classic (non-preview) not-ready state dims + hides the list.
  const gatePlaceholder = !addressReady && !previewWhenAddressNotReady

  return (
    <div
      className={cn(
        "mt-8 transition-opacity duration-300",
        gatePlaceholder && "opacity-30 pointer-events-none select-none"
      )}
    >
      <h2 className="text-lg font-semibold text-foreground mb-4 tracking-tight">
        {labels.shippingServices}
      </h2>

      {gatePlaceholder ? (
        <div className="p-4 bg-muted rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">{labels.deliveryDisabled}</p>
        </div>
      ) : shippingMethods.length === 0 ? (
        <div className="p-4 bg-muted rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">{labels.noShippingOptions}</p>
        </div>
      ) : (
        <div
          className={cn(
            showPreview &&
              "rounded-[2px] border border-dashed border-border/80 bg-muted/40 px-3.5 pt-3 pb-3.5"
          )}
        >
          {showPreview && (
            <div className="flex items-center gap-2 mb-3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"
                aria-hidden="true"
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {labels.deliveryPreviewHint}
              </p>
            </div>
          )}
          <div
            className={cn(
              "space-y-2",
              showPreview &&
                "grayscale opacity-60 pointer-events-none select-none"
            )}
          >
          {shippingMethods.map((option) => {
            // `cantCalc` fades a calculated-price option to opacity-40
            // when its price never resolved. Critically gated on BOTH
            // `!isLoadingPrices` AND `!shippingLoading` so we don't
            // visually punish an option just because the user is
            // mid-courier-switch — the in-flight setShippingMethod
            // call would otherwise leave a brief window where prices
            // are calculated=true but the new option's price hasn't
            // landed in the map yet, making it look broken.
            const cantCalc =
              option.price_type === "calculated" &&
              !isLoadingPrices &&
              !shippingLoading &&
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
            const isPigeonOffice =
              pigeon && !isEcontOffice && !isBoxnowLocker && detectPigeon(option)
            const hasExpanded =
              selected && (isEcontOffice || isBoxnowLocker || isPigeonOffice)
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
                  disabled={cantCalc || shippingLoading || showPreview}
                  onClick={showPreview ? undefined : () => onSelect(option.id)}
                  className={cn(
                    "flex items-center w-full px-4 py-3.5 text-left",
                    cantCalc && "opacity-40 cursor-not-allowed",
                    showPreview && "cursor-default"
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
                    {selected && isPigeonOffice && pigeon?.selectedOffice && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pigeon.selectedOffice.name}
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
                        <Price amount={price} currencyCode={currencyCode} />
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

                {hasExpanded && isPigeonOffice && pigeon && (
                  <PigeonOfficeSelector
                    userCity={pigeon.userCity}
                    userAddress={pigeon.userAddress}
                    selectedOffice={pigeon.selectedOffice}
                    onSelect={pigeon.onSelectOffice}
                  />
                )}
              </div>
            )
          })}
          </div>
        </div>
      )}

      <ErrorMessage
        error={shippingError}
        data-testid="delivery-error-message"
      />
    </div>
  )
}
