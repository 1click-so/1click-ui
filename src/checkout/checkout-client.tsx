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
  syncPaymentAmount,
  placeOrder,
  setShippingMethod,
  updateCart,
} from "../data/cart"
import { calculatePriceForShippingOption } from "../data/fulfillment"
import { updateCustomer } from "../data/customer"
import compareAddresses from "../data/util/compare-addresses"
import { isManual, isStripeLike } from "../lib/payment-constants"
import { useOrderConfirmedPath } from "./context"
import { CheckoutAddressForm } from "./address-form"
import type { EcontOffice } from "./econt-office-selector"
import type { BoxNowLocker } from "./boxnow-locker-selector"
import { MobileCheckoutBottomBar } from "./mobile-checkout-bottom-bar"
import { MobileCheckoutTopBar } from "./mobile-checkout-top-bar"
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
  /**
   * Per-store hook to restrict payment methods based on the currently
   * selected shipping option. Called whenever the shipping selection
   * changes; the returned array is what drives the Card / COD tab
   * visibility. Return the input unchanged to leave everything available.
   *
   * Example — hide COD when a BoxNow locker is selected:
   *   (methods, shippingOption) =>
   *     shippingOption?.data?.id === "boxnow-locker"
   *       ? methods?.filter((m) => !isManual(m.id)) ?? null
   *       : methods
   */
  paymentMethodFilter?: (
    methods:
      | Array<HttpTypes.StorePaymentProvider | { id: string }>
      | null,
    selectedShippingOption: HttpTypes.StoreCartShippingOption | null
  ) =>
    | Array<HttpTypes.StorePaymentProvider | { id: string }>
    | null
  /**
   * Optional per-store carrier branding for the shipping-method list.
   * Keyed by the stable fulfillment option id set by the backend
   * provider (shipping_option.data.id). See
   * `CheckoutShippingMethodList` for rendering details.
   */
  logoByFulfillmentOptionId?: Record<string, { src: string; alt: string }>
}

export function CheckoutClient({
  cart,
  customer,
  availableShippingMethods,
  availablePaymentMethods,
  countryCode,
  paymentMethodFilter,
  logoByFulfillmentOptionId,
}: CheckoutClientProps) {
  const orderConfirmedPath = useOrderConfirmedPath()
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

  const [selectedBoxnowLocker, setSelectedBoxnowLocker] =
    useState<BoxNowLocker | null>(
      cart?.metadata?.boxnow_locker_id
        ? ({
            id: cart.metadata.boxnow_locker_id as string,
            title: (cart.metadata.boxnow_locker_title as string) ?? "",
            addressLine1:
              (cart.metadata.boxnow_locker_address as string) ?? "",
            postalCode: (cart.metadata.boxnow_locker_postal as string) ?? "",
            lat: 0,
            lng: 0,
          } as BoxNowLocker)
        : null
    )

  const handleSelectBoxnowLocker = useCallback(
    (locker: BoxNowLocker | null) => {
      setSelectedBoxnowLocker(locker)
      if (locker) {
        updateCart({
          metadata: {
            ...(cart?.metadata ?? {}),
            boxnow_locker_id: locker.id,
            boxnow_locker_title: locker.title,
            boxnow_locker_address: locker.addressLine1 ?? "",
            boxnow_locker_postal: locker.postalCode ?? "",
          },
        }).catch(() => {})
      } else {
        updateCart({
          metadata: {
            ...(cart?.metadata ?? {}),
            boxnow_locker_id: null,
            boxnow_locker_title: null,
            boxnow_locker_address: null,
            boxnow_locker_postal: null,
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

  // Resolved here (instead of near deliveryReady) because
  // `effectiveAvailablePaymentMethods` needs to know the selection to
  // invoke the per-store `paymentMethodFilter` before hasCard/hasCod
  // are computed.
  const selectedShippingOption = useMemo(
    () =>
      shippingMethods.find((sm) => sm.id === selectedShippingMethod) ?? null,
    [shippingMethods, selectedShippingMethod]
  )

  // Per-store rule hook. Runs on every shipping-selection change so the
  // Card / COD tabs react live — e.g. Alenika hides COD when BoxNow is
  // chosen. Without a filter, the cart's region-wide methods pass through.
  const effectiveAvailablePaymentMethods = useMemo(
    () =>
      paymentMethodFilter
        ? paymentMethodFilter(availablePaymentMethods, selectedShippingOption)
        : availablePaymentMethods,
    [paymentMethodFilter, availablePaymentMethods, selectedShippingOption]
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

  // ── 3DS / bank-redirect return handler ──────────────────────────────
  // Stripe Payment Element calls confirmPayment with
  // redirect: "if_required". For methods that require a redirect (3DS
  // challenge, bank-redirect APMs), the browser navigates to
  // return_url (the checkout page itself) and comes back carrying
  // ?payment_intent=...&payment_intent_client_secret=...&redirect_status=...
  // We detect those on mount, call placeOrder when the status is
  // succeeded, and surface a clear error otherwise. Run once — we strip
  // the query params after handling so a refresh doesn't re-trigger.
  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    const redirectStatus = url.searchParams.get("redirect_status")
    const paymentIntentId = url.searchParams.get("payment_intent")
    if (!redirectStatus || !paymentIntentId) return

    // Strip the params immediately so refreshes and re-renders don't
    // trigger this effect again. `replaceState` avoids a navigation.
    ;[
      "redirect_status",
      "payment_intent",
      "payment_intent_client_secret",
    ].forEach((k) => url.searchParams.delete(k))
    window.history.replaceState({}, "", url.toString())

    if (redirectStatus === "succeeded") {
      // placeOrder redirects to the order confirmation page on success.
      placeOrder(undefined, undefined, orderConfirmedPath).catch(
        (err: unknown) => {
          setPaymentError(err instanceof Error ? err.message : String(err))
        }
      )
    } else {
      setPaymentError(
        "Плащането не беше потвърдено. Моля, опитайте отново или изберете друг метод."
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasCard = !!effectiveAvailablePaymentMethods?.some((m) => isStripeLike(m.id))
  const hasCod = !!effectiveAvailablePaymentMethods?.some((m) => isManual(m.id))
  const cardId = effectiveAvailablePaymentMethods?.find((m) => isStripeLike(m.id))?.id
  const codId = effectiveAvailablePaymentMethods?.find((m) => isManual(m.id))?.id

  const [paymentTab, setPaymentTab] = useState<"card" | "cod">(
    isManual(activePaymentSession?.provider_id) ? "cod" : hasCard ? "card" : "cod"
  )

  // Tracks which (cart.id, provider_id) pairs we've already initiated.
  // The cart prop is server-rendered ONCE and stays referentially
  // unchanged for the lifetime of the page until router.refresh, so
  // `activePaymentSession` derived from it stays stale-falsy after
  // initiatePaymentSession runs. Without this guard, the auto-init
  // useEffect + the reconcile useEffect + handleSelectShipping all fire
  // initiatePaymentSession in quick succession on a fresh cart. Each
  // call cancels the previous Stripe PI (Medusa's
  // createPaymentSessionsWorkflow does delete-old + create-new in
  // parallel), so by the time Stripe Elements finishes loading the
  // first PI's client_secret, that PI is already canceled — Stripe
  // returns "PaymentIntent is in a terminal state".
  const initiatedSessionsRef = useRef<Set<string>>(new Set())

  const handlePaymentTab = useCallback(
    async (tab: "card" | "cod") => {
      setPaymentTab(tab)
      setPaymentError(null)
      const pid = tab === "card" ? cardId : codId
      if (!pid) return

      const key = `${cart.id}:${pid}`
      if (initiatedSessionsRef.current.has(key)) return
      initiatedSessionsRef.current.add(key)

      try {
        await initiatePaymentSession(cart, { provider_id: pid })
      } catch (err: unknown) {
        // Failure: drop the guard so a retry (e.g. user toggling tabs)
        // can attempt again instead of being silently locked out.
        initiatedSessionsRef.current.delete(key)
        setPaymentError(err instanceof Error ? err.message : String(err))
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
      // Sync the Stripe payment session's amount to the cart's new
      // total. The route prefers stripe.paymentIntents.update (in
      // place, same client_secret) over rotation. When it succeeds,
      // <Elements> does NOT remount, so InitiateCheckout doesn't
      // refire and the address-form/orchestration tree stays mounted.
      // If the route reports `synced: false` (e.g. Medusa's
      // refresh-collection deleted the session because amount drift
      // exceeded its threshold), fall back to initiatePaymentSession
      // which bootstraps a fresh one.
      const pid = paymentTab === "card" ? cardId : codId
      if (pid) {
        ;(async () => {
          try {
            const result = await syncPaymentAmount(cart.id, pid)
            if (!result.synced) {
              const key = `${cart.id}:${pid}`
              if (!initiatedSessionsRef.current.has(key)) {
                initiatedSessionsRef.current.add(key)
                await initiatePaymentSession(cart, {
                  provider_id: pid,
                }).catch((err) => {
                  initiatedSessionsRef.current.delete(key)
                  throw err
                })
              }
            }
          } catch (err) {
            setPaymentError(err instanceof Error ? err.message : String(err))
          }
        })()
      }
    } catch (err: unknown) {
      setSelectedShippingMethod(prev)
      setShippingError(err instanceof Error ? err.message : String(err))
      setShippingLoading(false)
    }
  }

  // A BoxNow shipping option requires a locker selection before the
  // order can be placed (backend's createDeliveryRequest reads
  // cart.metadata.boxnow_locker_id as destination.locationId).
  // `selectedShippingOption` itself is defined higher up — it's needed
  // earlier so the payment-method filter can react to shipping changes.
  //
  // Delivery-type detection reads the fulfillment option id from
  // shipping_option.data.id — the stable identifier set by the backend
  // provider (see econt-fulfillment/service.ts → getFulfillmentOptions).
  // DO NOT parse the display name: admins rename options freely, and
  // "До точен адрес с ЕКОНТ" contains "еконт" but is address delivery,
  // not office delivery.
  const selectedFulfillmentOptionId = useMemo(() => {
    const data = selectedShippingOption?.data as
      | { id?: string }
      | undefined
      | null
    return typeof data?.id === "string" ? data.id : null
  }, [selectedShippingOption])
  const selectedIsBoxnow = selectedFulfillmentOptionId === "boxnow-locker"
  const selectedIsEcont = selectedFulfillmentOptionId === "econt-office"

  const deliveryReady =
    (!!selectedShippingMethod || (cart?.shipping_methods?.length ?? 0) > 0) &&
    (!selectedIsBoxnow || !!selectedBoxnowLocker) &&
    (!selectedIsEcont || !!selectedEcontOffice)

  // Auto-initiate payment session when delivery is ready
  useEffect(() => {
    if (deliveryReady && !activePaymentSession) {
      const defaultTab = hasCod ? "cod" : hasCard ? "card" : null
      if (defaultTab) handlePaymentTab(defaultTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryReady])

  // Reconcile paymentTab with the currently-available methods. When
  // the store's paymentMethodFilter strips a method in response to a
  // shipping selection (e.g. BoxNow → no COD), the previously selected
  // tab can point to a method that's no longer rendered. Result: the
  // remaining tab's radio looks unselected and the form stays
  // collapsed — exactly the "not pre-selected" symptom when switching
  // from an Econt/COD state to BoxNow. Switch the tab (and reinitiate
  // the session with the new provider) whenever availability changes
  // out from under the current selection.
  useEffect(() => {
    if (!deliveryReady) return
    if (paymentTab === "cod" && !hasCod && hasCard && cardId) {
      handlePaymentTab("card")
    } else if (paymentTab === "card" && !hasCard && hasCod && codId) {
      handlePaymentTab("cod")
    }
  }, [
    deliveryReady,
    paymentTab,
    hasCard,
    hasCod,
    cardId,
    codId,
    handlePaymentTab,
  ])

  // PaymentElement emits `complete: true` once the user has filled in
  // valid details for the selected method (card, Apple Pay, Google Pay,
  // etc.). We just clear any stale error — the actual confirmation
  // happens in PaymentButton via stripe.confirmPayment.
  const handlePaymentElementChange = (_e: {
    complete: boolean
    selectedMethod: string | null
  }) => {
    setPaymentError(null)
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

  const summaryCart = cart as HttpTypes.StoreCart & {
    promotions?: HttpTypes.StorePromotion[]
  }

  return (
    <>
      {/* Mobile-only: collapsible order summary at the top of the page.
          Lets the form fields start immediately below without wasting
          vertical space on an always-expanded summary. */}
      <MobileCheckoutTopBar
        cart={summaryCart}
        optimisticShippingCost={optimisticShippingCost}
      />

      <div className="max-w-[1140px] mx-auto px-5 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:justify-center gap-8 sm:gap-12">
          {/* ═══ LEFT: FORM ════════════════════════════════════════════ */}
          <div className="w-full sm:max-w-[480px]">
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
            boxnow={{
              selectedLocker: selectedBoxnowLocker,
              onSelectLocker: handleSelectBoxnowLocker,
              userCity: formData["shipping_address.city"] ?? "",
              userAddress: formData["shipping_address.address_1"] ?? "",
            }}
            logoByFulfillmentOptionId={logoByFulfillmentOptionId}
          />

          <CheckoutPaymentMethodList
            cart={cart}
            hasCard={hasCard}
            hasCod={hasCod}
            paymentTab={paymentTab}
            onPaymentTab={handlePaymentTab}
            deliveryReady={deliveryReady}
            paymentError={paymentError}
            onPaymentElementChange={handlePaymentElementChange}
            beforePaymentButton={
              <MobileCheckoutBottomBar
                cart={summaryCart}
                optimisticShippingCost={optimisticShippingCost}
              />
            }
          />
        </div>

        {/* ═══ RIGHT: ORDER SUMMARY (desktop only) ═══════════════════ */}
        <div className="hidden sm:block sm:w-[420px] flex-shrink-0">
          <div className="sm:sticky sm:top-6">
            <OrderSummary
              cart={summaryCart}
              optimisticShippingCost={optimisticShippingCost}
              onOptimisticShippingClear={() => setOptimisticShippingCost(null)}
            />
          </div>
        </div>
        </div>
      </div>
    </>
  )
}
