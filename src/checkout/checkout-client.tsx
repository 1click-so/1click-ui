"use client"

import type { HttpTypes } from "@medusajs/types"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react"

import {
  initiatePaymentSession,
  setShippingMethod,
  updateCart,
} from "../data/cart"
import { calculatePriceForShippingOption } from "../data/fulfillment"
import { updateCustomer } from "../data/customer"
import compareAddresses from "../data/util/compare-addresses"
import { isManual, isStripeLike } from "../lib/payment-constants"
import { CheckoutAddressForm } from "./address-form"
import type { EcontOffice } from "./econt-office-selector"
import { OrderSummary } from "./order-summary"
import { CheckoutPaymentMethodList } from "./payment-method-list"
import { CheckoutShippingMethodList } from "./shipping-method-list"

/**
 * CheckoutClient — single-page checkout orchestration. Holds all checkout
 * state (address form, shipping method, Econt office, payment tab, errors,
 * optimistic shipping cost), wires SDK calls from the library data layer,
 * and composes the three presentational primitives (address form, shipping
 * list, payment list) alongside the right-column OrderSummary.
 *
 * Extracted from mindpages-storefront
 * src/modules/checkout/templates/checkout-client/index.tsx — the 1684-line
 * monolith is now ~400 lines of state machine here, plus six focused
 * primitives importable individually. Stores that want a different section
 * order or a custom layout can write their own orchestration component
 * using the same primitives.
 *
 * KNOWN ISSUES absorbed during extraction:
 * - Dynamic `require("@lib/data/cart")` replaced with top-level imports
 *   from the library's data layer.
 * - `updateCustomer` call with `company_name` + metadata fields — these
 *   are documented as silently-dropped in KNOWN_ISSUES.md. The call
 *   stays here so the hook is in place once the backend is fixed, but
 *   only the standard `StoreUpdateCustomer` fields (first_name, last_name,
 *   phone) are passed. Company fields are still captured in `cart.metadata`.
 */

type CheckoutClientProps = {
  cart: HttpTypes.StoreCart
  customer: HttpTypes.StoreCustomer | null
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
  availablePaymentMethods:
    | Array<HttpTypes.StorePaymentProvider | { id: string }>
    | null
  countryCode: string
}

export function CheckoutClient({
  cart,
  customer,
  availableShippingMethods,
  availablePaymentMethods,
  countryCode,
}: CheckoutClientProps) {
  // ── Address form ───────────────────────────────────────────────────
  const [addressError, setAddressError] = useState<string | null>(null)
  const [, setAddressSaving] = useState(false)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [formData, setFormData] = useState<Record<string, string>>({
    "shipping_address.first_name":
      cart?.shipping_address?.first_name || customer?.first_name || "",
    "shipping_address.last_name":
      cart?.shipping_address?.last_name || customer?.last_name || "",
    "shipping_address.address_1": cart?.shipping_address?.address_1 || "",
    "shipping_address.company": cart?.shipping_address?.company || "",
    "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
    "shipping_address.city": cart?.shipping_address?.city || "",
    "shipping_address.country_code":
      cart?.shipping_address?.country_code || countryCode || "",
    "shipping_address.province": cart?.shipping_address?.province || "",
    "shipping_address.phone": cart?.shipping_address?.phone || "",
    email: cart?.email || customer?.email || "",
    company_name: (cart?.metadata?.company_name as string) || "",
    company_vat: (cart?.metadata?.company_vat as string) || "",
    company_mol: (cart?.metadata?.company_mol as string) || "",
    company_address: (cart?.metadata?.company_address as string) || "",
  })

  const [sameAsBilling] = useState(
    cart?.shipping_address && cart?.billing_address
      ? compareAddresses(
          cart.shipping_address as unknown as Record<string, unknown>,
          cart.billing_address as unknown as Record<string, unknown>
        )
      : true
  )

  const countriesInRegion = useMemo(
    () =>
      (cart?.region?.countries?.map((c) => c.iso_2) ?? []).filter(
        (c): c is string => Boolean(c)
      ),
    [cart?.region]
  )
  const addressesInRegion = useMemo(
    () =>
      customer?.addresses.filter(
        (a) => a.country_code && countriesInRegion.includes(a.country_code)
      ),
    [customer?.addresses, countriesInRegion]
  )

  const setFormAddress = useCallback(
    (address?: HttpTypes.StoreCartAddress, email?: string) => {
      if (address) {
        setFormData((prev) => ({
          ...prev,
          "shipping_address.first_name": address.first_name || "",
          "shipping_address.last_name": address.last_name || "",
          "shipping_address.address_1": address.address_1 || "",
          "shipping_address.company": address.company || "",
          "shipping_address.postal_code": address.postal_code || "",
          "shipping_address.city": address.city || "",
          "shipping_address.country_code": address.country_code || "",
          "shipping_address.province": address.province || "",
          "shipping_address.phone": address.phone || "",
        }))
      }
      if (email) setFormData((prev) => ({ ...prev, email }))
    },
    []
  )

  useEffect(() => {
    if (cart?.shipping_address) setFormAddress(cart.shipping_address, cart.email ?? undefined)
    if (cart && !cart.email && customer?.email)
      setFormAddress(undefined, customer.email)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.id])

  const requiredFields = [
    "email",
    "shipping_address.country_code",
    "shipping_address.first_name",
    "shipping_address.last_name",
    "shipping_address.address_1",
    "shipping_address.city",
    "shipping_address.postal_code",
  ]

  const allRequiredFilled = requiredFields.every(
    (f) => (formData[f] ?? "").trim().length > 0
  )

  const saveAddress = useCallback(async () => {
    if (!allRequiredFilled) return
    setAddressSaving(true)
    setAddressError(null)
    try {
      type CartUpdateBody = HttpTypes.StoreUpdateCart & {
        billing_address?: HttpTypes.StoreUpdateCart["shipping_address"]
      }
      const addressData: CartUpdateBody = {
        shipping_address: {
          first_name: formData["shipping_address.first_name"],
          last_name: formData["shipping_address.last_name"],
          address_1: formData["shipping_address.address_1"],
          address_2: "",
          company: formData["shipping_address.company"] || "",
          postal_code: formData["shipping_address.postal_code"],
          city: formData["shipping_address.city"],
          country_code: formData["shipping_address.country_code"],
          province: formData["shipping_address.province"] || "",
          phone: formData["shipping_address.phone"] || "",
        },
        email: formData.email,
      }
      if (sameAsBilling)
        addressData.billing_address = addressData.shipping_address

      const hasCompany = formData.company_name?.trim()
      if (hasCompany) {
        addressData.metadata = {
          ...(cart?.metadata ?? {}),
          company_name: formData.company_name,
          company_vat: formData.company_vat || "",
          company_mol: formData.company_mol || "",
          company_address: formData.company_address || "",
        }
      }

      await updateCart(addressData)

      if (customer) {
        // Only pass standard StoreUpdateCustomer fields. Company fields
        // are captured in cart.metadata above — see KNOWN_ISSUES.md.
        updateCustomer({
          first_name: formData["shipping_address.first_name"],
          last_name: formData["shipping_address.last_name"],
          phone: formData["shipping_address.phone"] || undefined,
        }).catch(() => {})
      }
    } catch (e: unknown) {
      setAddressError(e instanceof Error ? e.message : String(e))
    } finally {
      setAddressSaving(false)
    }
  }, [formData, allRequiredFilled, sameAsBilling, customer, cart?.metadata])

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleFormChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const updated = { ...formData, [e.target.name]: e.target.value }
    setFormData(updated)

    // For selects (country), save immediately on change since there's no blur
    if (e.target.tagName === "SELECT") {
      const filled = requiredFields.every(
        (f) => (updated[f] ?? "").trim().length > 0
      )
      if (filled) saveAddress()
    }
  }

  const handleFieldBlur = () => {
    if (allRequiredFilled) saveAddress()
  }

  const addressReady =
    allRequiredFilled || !!(cart?.shipping_address && cart?.email)

  // ── Shipping ────────────────────────────────────────────────────────
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [optimisticShippingCost, setOptimisticShippingCost] = useState<
    number | null
  >(null)

  const [selectedShippingMethod, setSelectedShippingMethod] = useState<
    string | null
  >(cart?.shipping_methods?.at(-1)?.shipping_option_id || null)

  const [selectedEcontOffice, setSelectedEcontOffice] =
    useState<EcontOffice | null>(
      cart?.metadata?.econt_office_code
        ? ({
            code: cart.metadata.econt_office_code as string,
            name: cart.metadata.econt_office_name as string,
          } as EcontOffice)
        : null
    )

  const handleSelectEcontOffice = useCallback(
    (office: EcontOffice | null) => {
      setSelectedEcontOffice(office)
      if (office) {
        const addr = [office.address?.street, office.address?.num]
          .filter(Boolean)
          .join(" ")
        updateCart({
          metadata: {
            ...(cart?.metadata ?? {}),
            econt_office_code: office.code,
            econt_office_name: office.name,
            econt_office_city: office.address?.city?.name || "",
            econt_office_address: addr,
            econt_office_phone: office.phones?.[0] || "",
          },
        }).catch(() => {})
      } else {
        updateCart({
          metadata: {
            ...(cart?.metadata ?? {}),
            econt_office_code: null,
            econt_office_name: null,
            econt_office_city: null,
            econt_office_address: null,
            econt_office_phone: null,
          },
        }).catch(() => {})
      }
    },
    [cart?.metadata]
  )

  const [calculatedPricesMap, setCalculatedPricesMap] = useState<
    Record<string, number>
  >({})
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)

  const shippingMethods = useMemo(
    () =>
      (availableShippingMethods ?? []).filter(
        (sm) =>
          (sm as { service_zone?: { fulfillment_set?: { type?: string } } })
            .service_zone?.fulfillment_set?.type !== "pickup"
      ),
    [availableShippingMethods]
  )

  useEffect(() => {
    if (!shippingMethods.length) {
      setIsLoadingPrices(false)
      return
    }
    setIsLoadingPrices(true)
    const calculated = shippingMethods.filter(
      (sm) => sm.price_type === "calculated"
    )
    if (!calculated.length) {
      setIsLoadingPrices(false)
      return
    }
    Promise.allSettled(
      calculated.map((sm) => calculatePriceForShippingOption(sm.id, cart.id))
    ).then((res) => {
      const map: Record<string, number> = {}
      res.forEach((p) => {
        if (p.status === "fulfilled" && p.value)
          map[p.value.id ?? ""] = p.value.amount ?? 0
      })
      setCalculatedPricesMap(map)
      setIsLoadingPrices(false)
    })
  }, [availableShippingMethods, cart.id, shippingMethods])

  // ── Payment ─────────────────────────────────────────────────────────
  const activePaymentSession =
    cart?.payment_collection?.payment_sessions?.find(
      (s) => s.status === "pending"
    )
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const hasCard = !!availablePaymentMethods?.some((m) => isStripeLike(m.id))
  const hasCod = !!availablePaymentMethods?.some((m) => isManual(m.id))
  const cardId = availablePaymentMethods?.find((m) => isStripeLike(m.id))?.id
  const codId = availablePaymentMethods?.find((m) => isManual(m.id))?.id

  const [paymentTab, setPaymentTab] = useState<"card" | "cod">(
    isManual(activePaymentSession?.provider_id) ? "cod" : hasCard ? "card" : "cod"
  )

  const handlePaymentTab = useCallback(
    async (tab: "card" | "cod") => {
      setPaymentTab(tab)
      setPaymentError(null)
      const pid = tab === "card" ? cardId : codId
      if (pid) {
        try {
          await initiatePaymentSession(cart, { provider_id: pid })
        } catch (err: unknown) {
          setPaymentError(err instanceof Error ? err.message : String(err))
        }
      }
    },
    [cart, cardId, codId]
  )

  const handleSelectShipping = async (id: string) => {
    setShippingError(null)
    const prev = selectedShippingMethod
    setShippingLoading(true)
    setSelectedShippingMethod(id)

    // Optimistic: set shipping cost immediately from known prices
    const option = shippingMethods.find((m) => m.id === id)
    if (option) {
      const price =
        option.price_type === "flat"
          ? option.amount
          : calculatedPricesMap[option.id]
      if (price !== undefined) setOptimisticShippingCost(price)
    }

    try {
      await setShippingMethod({ cartId: cart.id, shippingMethodId: id })
      setShippingLoading(false)
      // Re-initiate payment in background
      const pid = paymentTab === "card" ? cardId : codId
      if (pid) {
        initiatePaymentSession(cart, { provider_id: pid }).catch((err) => {
          setPaymentError(err instanceof Error ? err.message : String(err))
        })
      }
    } catch (err: unknown) {
      setSelectedShippingMethod(prev)
      setShippingError(err instanceof Error ? err.message : String(err))
      setShippingLoading(false)
    }
  }

  const deliveryReady =
    !!selectedShippingMethod || (cart?.shipping_methods?.length ?? 0) > 0

  // Auto-initiate payment session when delivery is ready
  useEffect(() => {
    if (deliveryReady && !activePaymentSession) {
      const defaultTab = hasCod ? "cod" : hasCard ? "card" : null
      if (defaultTab) handlePaymentTab(defaultTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryReady])

  const handleCardChange = (e: {
    complete: boolean
    error?: { message?: string }
    brand?: string
  }) => {
    setPaymentError(e.error?.message ?? null)
  }

  const addressInput = useMemo(() => {
    return {
      first_name: formData["shipping_address.first_name"],
      last_name: formData["shipping_address.last_name"],
      address_1: formData["shipping_address.address_1"],
      company: formData["shipping_address.company"],
      postal_code: formData["shipping_address.postal_code"],
      city: formData["shipping_address.city"],
      country_code: formData["shipping_address.country_code"],
      province: formData["shipping_address.province"],
      phone: formData["shipping_address.phone"],
    } as HttpTypes.StoreCartAddress
  }, [formData])

  const regionCountries = useMemo(
    () =>
      (cart?.region?.countries ?? []).map((c) => ({
        iso_2: c.iso_2 ?? "",
        display_name: c.display_name ?? "",
      })),
    [cart?.region]
  )

  return (
    <div className="max-w-[1140px] mx-auto px-5 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:justify-center gap-8 sm:gap-12">
        {/* ═══ LEFT: FORM ════════════════════════════════════════════ */}
        <div className="w-full sm:max-w-[480px] order-2 sm:order-1">
          <CheckoutAddressForm
            formData={formData}
            onChange={handleFormChange}
            onBlur={handleFieldBlur}
            savedAddresses={addressesInRegion ?? undefined}
            onSelectSavedAddress={setFormAddress}
            countries={regionCountries}
            addressInput={addressInput}
            addressError={addressError}
          />

          <CheckoutShippingMethodList
            shippingMethods={shippingMethods}
            selectedShippingMethodId={selectedShippingMethod}
            calculatedPricesMap={calculatedPricesMap}
            isLoadingPrices={isLoadingPrices}
            shippingLoading={shippingLoading}
            shippingError={shippingError}
            onSelect={handleSelectShipping}
            addressReady={addressReady}
            currencyCode={cart.currency_code}
            econt={{
              selectedOffice: selectedEcontOffice,
              onSelectOffice: handleSelectEcontOffice,
              userCity: formData["shipping_address.city"] ?? "",
              userAddress: formData["shipping_address.address_1"] ?? "",
            }}
          />

          <CheckoutPaymentMethodList
            cart={cart}
            hasCard={hasCard}
            hasCod={hasCod}
            paymentTab={paymentTab}
            onPaymentTab={handlePaymentTab}
            deliveryReady={deliveryReady}
            paymentError={paymentError}
            onCardChange={handleCardChange}
            onCardFieldError={setPaymentError}
          />
        </div>

        {/* ═══ RIGHT: ORDER SUMMARY ══════════════════════════════════ */}
        <div className="w-full sm:w-[420px] order-1 sm:order-2 flex-shrink-0">
          <div className="sm:sticky sm:top-6">
            <OrderSummary
              cart={cart as HttpTypes.StoreCart & { promotions?: HttpTypes.StorePromotion[] }}
              optimisticShippingCost={optimisticShippingCost}
              onOptimisticShippingClear={() => setOptimisticShippingCost(null)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
