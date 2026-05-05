"use client"

import type { HttpTypes } from "@medusajs/types"
import type { ChangeEvent } from "react"

import { Field } from "../primitives/field"
import { SelectField } from "../primitives/select-field"
import { AddressSelect } from "./address-select"
import { CompanyDetails } from "./company-details"
import { useCheckoutLabels } from "./context"
import { ErrorMessage } from "./error-message"

/**
 * CheckoutAddressForm — the delivery address + email section of the
 * checkout. Presentational: state and handlers come from the parent
 * (`CheckoutClient`).
 *
 * Extracted from mindpages-storefront checkout-client/index.tsx — the
 * `Информация за доставка` section (roughly lines 746-886).
 */

type CheckoutAddressFormProps = {
  formData: Record<string, string>
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onBlur: () => void
  /** Saved addresses from the customer profile (optional) */
  savedAddresses?: HttpTypes.StoreCustomerAddress[]
  /** Handler for selecting a saved address */
  onSelectSavedAddress?: (
    address: HttpTypes.StoreCartAddress | undefined,
    email?: string
  ) => void
  /** Region countries for the country select */
  countries: Array<{ iso_2: string; display_name: string }>
  /** Current address input (for saved-address match detection) */
  addressInput: HttpTypes.StoreCartAddress | null
  addressError: string | null
  /**
   * Hide the country field entirely. Useful for single-country stores
   * (Alenika is BG-only) where the field is redundant. The
   * `country_code` value still lives in formData (initialized from the
   * `countryCode` prop on `useCheckoutOrchestration`), so submissions
   * still carry it. Default false — library-generic.
   */
  hideCountry?: boolean
  /**
   * Set of formData keys that are required-but-empty AND should be
   * visually pulsed (3s-idle attention cue). The orchestration hook
   * computes this; the form just reads it and applies the soft-blue
   * pulse class to matching fields. Empty set / undefined = no cue.
   */
  pulseFields?: Set<string>
}

export function CheckoutAddressForm({
  formData,
  onChange,
  onBlur,
  savedAddresses,
  onSelectSavedAddress,
  countries,
  addressInput,
  addressError,
  hideCountry = false,
  pulseFields,
}: CheckoutAddressFormProps) {
  const labels = useCheckoutLabels()
  const p = (k: string) => !!pulseFields?.has(k)

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-5 tracking-tight">
        {labels.deliveryInfo}
      </h2>

      {savedAddresses && savedAddresses.length > 0 && onSelectSavedAddress && (
        <div className="mb-5 p-4 bg-muted rounded-xl border border-border">
          <p className="text-sm text-muted-foreground mb-3">{labels.useSavedAddress}</p>
          <AddressSelect
            addresses={savedAddresses}
            addressInput={addressInput}
            onSelect={onSelectSavedAddress}
          />
        </div>
      )}

      <div className="space-y-2.5">
        <Field
          label={labels.email}
          name="email"
          type="email"
          autoComplete="email"
          value={formData.email ?? ""}
          onChange={onChange}
          onBlur={onBlur}
          required
          pulse={p("email")}
        />

        {!hideCountry && (
          countries.length === 1 ? (
            // Single-country region — render a readonly field showing
            // the localized country name. (Library-default rendering
            // when `hideCountry` isn't passed.) The actual country_code
            // remains in formData so submission still carries it.
            <Field
              label={labels.country}
              name="shipping_address.country_code_display"
              value={
                labels.singleCountryName ??
                countries[0]?.display_name ??
                ""
              }
              onChange={() => {}}
              readOnly
            />
          ) : (
            <SelectField
              label={labels.country}
              name="shipping_address.country_code"
              autoComplete="country"
              value={formData["shipping_address.country_code"] ?? ""}
              onChange={onChange}
              required
            >
              <option value="" disabled />
              {countries.map((c) => (
                <option key={c.iso_2} value={c.iso_2}>
                  {c.display_name}
                </option>
              ))}
            </SelectField>
          )
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <Field
            label={labels.firstName}
            name="shipping_address.first_name"
            autoComplete="given-name"
            value={formData["shipping_address.first_name"] ?? ""}
            onChange={onChange}
            onBlur={onBlur}
            required
            pulse={p("shipping_address.first_name")}
          />
          <Field
            label={labels.lastName}
            name="shipping_address.last_name"
            autoComplete="family-name"
            value={formData["shipping_address.last_name"] ?? ""}
            onChange={onChange}
            onBlur={onBlur}
            required
            pulse={p("shipping_address.last_name")}
          />
        </div>

        <Field
          label={labels.address}
          name="shipping_address.address_1"
          autoComplete="address-line1"
          value={formData["shipping_address.address_1"] ?? ""}
          onChange={onChange}
          onBlur={onBlur}
          required
          pulse={p("shipping_address.address_1")}
        />

        <Field
          label={labels.apartment}
          name="shipping_address.company"
          autoComplete="address-line2"
          value={formData["shipping_address.company"] ?? ""}
          onChange={onChange}
          onBlur={onBlur}
        />

        <div className="grid grid-cols-2 gap-2.5">
          <Field
            label={labels.postalCode}
            name="shipping_address.postal_code"
            autoComplete="postal-code"
            value={formData["shipping_address.postal_code"] ?? ""}
            onChange={onChange}
            onBlur={onBlur}
            required
            pulse={p("shipping_address.postal_code")}
          />
          <Field
            label={labels.city}
            name="shipping_address.city"
            autoComplete="address-level2"
            value={formData["shipping_address.city"] ?? ""}
            onChange={onChange}
            onBlur={onBlur}
            required
            pulse={p("shipping_address.city")}
          />
        </div>

        <Field
          label={labels.phone}
          name="shipping_address.phone"
          type="tel"
          autoComplete="tel"
          value={formData["shipping_address.phone"] ?? ""}
          onChange={onChange}
          onBlur={onBlur}
          pulse={p("shipping_address.phone")}
        />
      </div>

      <CompanyDetails formData={formData} onChange={onChange} onBlur={onBlur} />

      <ErrorMessage error={addressError} data-testid="address-error-message" />
    </div>
  )
}
