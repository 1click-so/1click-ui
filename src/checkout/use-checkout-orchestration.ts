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
  logCheckoutError,
  placeOrder,
  setShippingMethod,
  syncPaymentAmount,
  updateCart,
} from "../data/cart"
import { calculatePriceForShippingOption } from "../data/fulfillment"
import { updateCustomer } from "../data/customer"
import compareAddresses from "../data/util/compare-addresses"
import { isManual, isStripeLike } from "../lib/payment-constants"

import { useOrderConfirmedPath } from "./context"
import type { EcontOffice } from "./econt-office-selector"
import type { BoxNowLocker } from "./boxnow-locker-selector"
import { translatePaymentError } from "./payment-error-copy"

/**
 * useCheckoutOrchestration — single source of truth for checkout-page
 * orchestration. All race-condition guards, payment-session lifecycle,
 * shipping/address mutations, carrier metadata, completed-cart detection
 * and 3DS-return handling live here. Library's CheckoutClient and any
 * store's custom orchestration component (e.g. AlenikaCheckoutOrchestration)
 * consume this hook — they own only the layout and any store-specific
 * concerns (tracking, sessionStorage form persistence, custom summary).
 *
 * Why a hook and not a base component:
 *   - Stores fork the layout for legitimate reasons (champagne split,
 *     tracking, custom summary). They should NOT have to fork the
 *     orchestration logic too — that's how this fork DROPPED the
 *     `initiatedSessionsRef` guard and `syncPaymentAmount` flow during
 *     the v1.15 → v1.16 cycle, producing zombie Stripe sessions on rapid
 *     payment-tab toggles. Centralizing the logic here makes that class
 *     of fork-rot bug structurally impossible.
 *
 * What the hook owns:
 *   - Address form state + autosave to cart (`updateCart` + `updateCustomer`)
 *   - Shipping method selection with `syncPaymentAmount` fast-path
 *     (preserves Stripe `client_secret` on amount-only changes; no
 *     `<Elements>` remount; no card-form blank-out)
 *   - Carrier metadata (Econt office, BoxNow locker) with sibling-null
 *     pattern so the previously selected carrier's fields don't leak
 *     into the next selection
 *   - Payment tab state + `initiatedSessionsRef` Set guard against
 *     concurrent in-flight payment-session inits
 *   - 3DS return handling — validates `payment_intent` matches the
 *     cart's active session, translates errors via `translatePaymentError`
 *     into the configured locale, logs `place_order_error` to
 *     `checkout_error_log` for operational visibility
 *   - Completed-cart detection (returned via `cartIsCompleted` so the
 *     consumer's page-level component can `redirect()` server-side)
 *
 * What the hook does NOT own:
 *   - Tracking events (Meta InitiateCheckout, GA4 begin_checkout) — store
 *     decides when/whether to fire
 *   - sessionStorage form persistence — store decides scope + key
 *   - Layout / JSX — store owns the shell
 *   - Custom order summary components
 *   - Optimistic COD-fee state — store-specific (only Alenika has the
 *     codConfig today). The hook DOES expose `optimisticCodFee` /
 *     `setOptimisticCodFee` plumbing so a store with COD fee config can
 *     wire its prediction without re-implementing the toggle logic.
 *
 * The exact shape of the returned object mirrors what the previous
 * monolithic CheckoutClient kept in local state, so the refactor is
 * mechanical: replace inline state with destructure from the hook.
 */

export type CheckoutCodConfig = {
  enabled: true
  fee_amount: number
  fee_currency: string
  fee_label: string
  description?: string | null
} | null

export type UseCheckoutOrchestrationOptions = {
  cart: HttpTypes.StoreCart
  customer: HttpTypes.StoreCustomer | null
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
  availablePaymentMethods:
    | Array<HttpTypes.StorePaymentProvider | { id: string }>
    | null
  /** Default country code when the cart has no shipping address yet. */
  countryCode?: string
  /**
   * Per-store rule for filtering payment methods based on the currently
   * selected shipping option (e.g. hide COD when BoxNow is selected).
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
   * Optional cash-on-delivery configuration. When present, the hook
   * paints `optimisticCodFee` on tab-toggle so the totals row updates
   * before the server-side fee line item arrives.
   */
  codConfig?: CheckoutCodConfig
  /**
   * Order-confirmed redirect path. Falls back to the value provided by
   * the CheckoutProvider context. Stores with custom routing (no country
   * segment, custom slug) override per-call site.
   */
  orderConfirmedPath?: string
  /**
   * Optional metadata included in `placeOrder`'s tracking attribution.
   * Currently used by the 3DS return path to forward engagement-time
   * for GA4. Stores can pass a function that returns a fresh value at
   * call time.
   */
  resolvePlaceOrderTracking?: () =>
    | { engagementTimeMsec?: number }
    | undefined
}

/**
 * Address form fields the orchestration tracks. Matches the keys the
 * library's `CheckoutAddressForm` writes via `name=...`.
 */
const REQUIRED_ADDRESS_FIELDS = [
  "email",
  "shipping_address.country_code",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.address_1",
  "shipping_address.city",
  "shipping_address.postal_code",
] as const

export function useCheckoutOrchestration({
  cart,
  customer,
  availableShippingMethods,
  availablePaymentMethods,
  countryCode = "",
  paymentMethodFilter,
  codConfig,
  orderConfirmedPath: orderConfirmedPathProp,
  resolvePlaceOrderTracking,
}: UseCheckoutOrchestrationOptions) {
  // Resolve the order-confirmed path. Prop wins; otherwise fall back to
  // the value provided by CheckoutProvider context. Library default is
  // typically "/{countryCode}/order/{id}/confirmed"; alenika overrides
  // to "/order/{id}/confirmed" because its routing has no country segment.
  const contextOrderConfirmedPath = useOrderConfirmedPath()
  const orderConfirmedPath =
    orderConfirmedPathProp ?? contextOrderConfirmedPath

  // ── Completed-cart detection ────────────────────────────────────────
  // Surfaced as a flag so the page-level server component can redirect
  // before any client-side mutation runs. The cart cookie can outlive a
  // completed checkout (back button after order, second tab on the same
  // session) and the storefront previously rendered the full form on
  // top — leading to a second `cart.complete` attempt that returns
  // "Cart is already completed" in raw English.
  const cartIsCompleted = useMemo(
    () => Boolean((cart as { completed_at?: string | null })?.completed_at),
    [cart]
  )

  // ── Address form ────────────────────────────────────────────────────
  const [addressError, setAddressError] = useState<string | null>(null)
  const [, setAddressSaving] = useState(false)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  // In-flight guard against concurrent saveAddress calls. Without this,
  // rapid blur events (email → tab → phone → tab) queue parallel
  // updateCart writes; the later-resolving one wins, and any field the
  // user edited between the two clicks gets reverted to the earlier
  // snapshot.
  const addressSavingRef = useRef(false)

  const [formData, setFormData] = useState<Record<string, string>>(() => ({
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
  }))

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

  // Re-seed formData from cart when it changes id (e.g. region switch
  // creates a fresh cart). Disabled within the same cart id so user's
  // in-progress edits aren't clobbered by router refresh after a
  // shipping/payment mutation.
  useEffect(() => {
    if (cart?.shipping_address)
      setFormAddress(cart.shipping_address, cart.email ?? undefined)
    if (cart && !cart.email && customer?.email)
      setFormAddress(undefined, customer.email)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.id])

  const allRequiredFilled = REQUIRED_ADDRESS_FIELDS.every(
    (f) => (formData[f] ?? "").trim().length > 0
  )

  const saveAddress = useCallback(async () => {
    if (!allRequiredFilled) return
    if (addressSavingRef.current) return
    addressSavingRef.current = true
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
        // Only standard `StoreUpdateCustomer` fields; company fields are
        // captured in cart.metadata above. See KNOWN_ISSUES.md.
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
      addressSavingRef.current = false
    }
  }, [formData, allRequiredFilled, sameAsBilling, customer, cart?.metadata])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleFormChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const updated = { ...formData, [e.target.name]: e.target.value }
      setFormData(updated)

      // For selects (country), save immediately on change since there's
      // no blur. Reads from `updated` (not `formData`) so the post-set
      // value is what gets validated and persisted.
      if (e.target.tagName === "SELECT") {
        const filled = REQUIRED_ADDRESS_FIELDS.every(
          (f) => (updated[f] ?? "").trim().length > 0
        )
        if (filled) saveAddress()
      }
    },
    [formData, saveAddress]
  )

  const handleFieldBlur = useCallback(() => {
    if (allRequiredFilled) saveAddress()
  }, [allRequiredFilled, saveAddress])

  const addressReady =
    allRequiredFilled || !!(cart?.shipping_address && cart?.email)

  const addressInput = useMemo(
    () =>
      ({
        first_name: formData["shipping_address.first_name"],
        last_name: formData["shipping_address.last_name"],
        address_1: formData["shipping_address.address_1"],
        company: formData["shipping_address.company"],
        postal_code: formData["shipping_address.postal_code"],
        city: formData["shipping_address.city"],
        country_code: formData["shipping_address.country_code"],
        province: formData["shipping_address.province"],
        phone: formData["shipping_address.phone"],
      } as HttpTypes.StoreCartAddress),
    [formData]
  )

  const regionCountries = useMemo(
    () =>
      (cart?.region?.countries ?? []).map((c) => ({
        iso_2: c.iso_2 ?? "",
        display_name: c.display_name ?? "",
      })),
    [cart?.region]
  )

  // ── Shipping ────────────────────────────────────────────────────────
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [optimisticShippingCost, setOptimisticShippingCost] = useState<
    number | null
  >(null)
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<
    string | null
  >(cart?.shipping_methods?.at(-1)?.shipping_option_id || null)

  const shippingMethods = useMemo(
    () =>
      (availableShippingMethods ?? []).filter(
        (sm) =>
          (sm as { service_zone?: { fulfillment_set?: { type?: string } } })
            .service_zone?.fulfillment_set?.type !== "pickup"
      ),
    [availableShippingMethods]
  )

  const selectedShippingOption = useMemo(
    () =>
      shippingMethods.find((sm) => sm.id === selectedShippingMethod) ?? null,
    [shippingMethods, selectedShippingMethod]
  )

  const effectiveAvailablePaymentMethods = useMemo(
    () =>
      paymentMethodFilter
        ? paymentMethodFilter(availablePaymentMethods, selectedShippingOption)
        : availablePaymentMethods,
    [paymentMethodFilter, availablePaymentMethods, selectedShippingOption]
  )

  const [calculatedPricesMap, setCalculatedPricesMap] = useState<
    Record<string, number>
  >({})
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)

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

  // ── Carrier metadata ────────────────────────────────────────────────
  // Sibling-null pattern: when picking a carrier-specific destination
  // (Econt office or BoxNow locker), explicitly null the OTHER carrier's
  // fields so a stale local cart prop spread doesn't carry the previous
  // carrier's data back to the server. Medusa replaces metadata
  // wholesale (no merge), so an explicit null wins over a stale spread.
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
            // Sibling carrier: always null when picking Econt
            boxnow_locker_id: null,
            boxnow_locker_title: null,
            boxnow_locker_address: null,
            boxnow_locker_postal: null,
            // New selection
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
            // Sibling carrier: always null when picking BoxNow
            econt_office_code: null,
            econt_office_name: null,
            econt_office_city: null,
            econt_office_address: null,
            econt_office_phone: null,
            // New selection
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

  // ── Payment ─────────────────────────────────────────────────────────
  const activePaymentSession =
    cart?.payment_collection?.payment_sessions?.find(
      (s) => s.status === "pending"
    )
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const hasCard = !!effectiveAvailablePaymentMethods?.some((m) =>
    isStripeLike(m.id)
  )
  const hasCod = !!effectiveAvailablePaymentMethods?.some((m) =>
    isManual(m.id)
  )
  const cardId = effectiveAvailablePaymentMethods?.find((m) =>
    isStripeLike(m.id)
  )?.id
  const codId = effectiveAvailablePaymentMethods?.find((m) =>
    isManual(m.id)
  )?.id

  const [paymentTab, setPaymentTab] = useState<"card" | "cod">(
    isManual(activePaymentSession?.provider_id)
      ? "cod"
      : hasCard
      ? "card"
      : "cod"
  )

  // Optimistic COD-fee state. Painted instantly on tab toggle so the
  // totals row shows the predicted fee BEFORE the server-side fee line
  // item arrives via router.refresh(). Three values:
  //   - null         → no prediction; render whatever the cart says
  //   - 0            → predict no fee (toggling away from COD)
  //   - positive     → predict the fee at this amount (toggling to COD)
  const [optimisticCodFee, setOptimisticCodFee] = useState<number | null>(
    null
  )

  // Tracks `(cart.id, provider_id)` pairs we've already initiated. Without
  // this guard, the auto-init useEffect, the reconcile useEffect, and a
  // rapid handleSelectShipping all fire `initiatePaymentSession` in quick
  // succession on a fresh cart. Each call cancels the previous Stripe
  // PI in parallel; whichever Elements instance mounted first now holds
  // a dead client_secret → "PaymentIntent in terminal state" on first
  // card-load. Set lifetime is the lifetime of this hook instance.
  const initiatedSessionsRef = useRef<Set<string>>(new Set())

  const handlePaymentTab = useCallback(
    async (tab: "card" | "cod") => {
      setPaymentTab(tab)
      setPaymentError(null)

      // Optimistic prediction — paint totals BEFORE the network call.
      // Currency must match the configured fee currency or the middleware
      // skips the fee server-side, so optimistic must skip too.
      if (codConfig) {
        const codCurrencyMatches =
          codConfig.fee_currency.toLowerCase() ===
          (cart.currency_code || "").toLowerCase()
        if (tab === "cod" && codCurrencyMatches) {
          setOptimisticCodFee(codConfig.fee_amount)
        } else {
          setOptimisticCodFee(0)
        }
      }

      const pid = tab === "card" ? cardId : codId
      if (!pid) return

      const key = `${cart.id}:${pid}`
      if (initiatedSessionsRef.current.has(key)) return
      initiatedSessionsRef.current.add(key)

      try {
        await initiatePaymentSession(cart, { provider_id: pid })
      } catch (err: unknown) {
        // Drop the guard so a retry can attempt again instead of being
        // silently locked out.
        initiatedSessionsRef.current.delete(key)
        setPaymentError(err instanceof Error ? err.message : String(err))
        // Roll back optimistic fee so UI doesn't keep a phantom row.
        if (codConfig) setOptimisticCodFee(null)
      }
    },
    [cart, cardId, codId, codConfig]
  )

  const handleSelectShipping = useCallback(
    async (id: string) => {
      setShippingError(null)
      const prev = selectedShippingMethod
      setShippingLoading(true)
      setSelectedShippingMethod(id)

      // Optimistic shipping cost from known-or-flat-priced options.
      const option = shippingMethods.find((m) => m.id === id)
      if (option) {
        const price =
          option.price_type === "flat"
            ? option.amount
            : calculatedPricesMap[option.id]
        if (price !== undefined) setOptimisticShippingCost(price)
      }

      // Clear ALL carrier-specific metadata on shipping switch.
      // Without this, picking BoxNow → locker → switching to Econt
      // office → switching to direct-address leaves both
      // boxnow_locker_* AND econt_office_* set on the cart, and admin's
      // order-fulfillment widget detects the FIRST non-empty group
      // (BoxNow wins) — generating a waybill to the wrong destination.
      setSelectedBoxnowLocker(null)
      setSelectedEcontOffice(null)
      updateCart({
        metadata: {
          ...(cart?.metadata ?? {}),
          boxnow_locker_id: null,
          boxnow_locker_title: null,
          boxnow_locker_address: null,
          boxnow_locker_postal: null,
          econt_office_code: null,
          econt_office_name: null,
          econt_office_city: null,
          econt_office_address: null,
          econt_office_phone: null,
        },
      }).catch(() => {})

      try {
        await setShippingMethod({ cartId: cart.id, shippingMethodId: id })
        setShippingLoading(false)

        // syncPaymentAmount preserves the Stripe client_secret on
        // amount-only changes (no <Elements> remount, no card-form
        // blank-out). On `synced: false` (provider mismatch / Stripe
        // rejection / Medusa deleted the session for amount-drift) the
        // initiatedSessionsRef-guarded fallback bootstraps a fresh one.
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
              setPaymentError(
                err instanceof Error ? err.message : String(err)
              )
            }
          })()
        }
      } catch (err: unknown) {
        setSelectedShippingMethod(prev)
        setShippingError(err instanceof Error ? err.message : String(err))
        setShippingLoading(false)
      }
    },
    [
      cart,
      selectedShippingMethod,
      shippingMethods,
      calculatedPricesMap,
      paymentTab,
      cardId,
      codId,
    ]
  )

  // ── Delivery readiness ──────────────────────────────────────────────
  const selectedFulfillmentOptionId = useMemo(() => {
    const data = selectedShippingOption?.data as
      | { id?: string }
      | undefined
      | null
    return typeof data?.id === "string" ? data.id : null
  }, [selectedShippingOption])
  const selectedIsBoxnow = selectedFulfillmentOptionId === "boxnow-locker"
  const selectedIsEcont = selectedFulfillmentOptionId === "econt-office"

  // Defensive: trust cart.metadata for locker/office IDs in addition to
  // local React state. On mobile we've seen the BoxNow locker selector
  // fire its onSelect handler in a way that updates cart.metadata cleanly
  // but leaves the local `selectedBoxnowLocker` stale (touch event timing
  // / hydration race). Without this fallback, the local-null kept
  // `deliveryReady` false and the entire payment section turned into a
  // ghost — even though the cart server-side knew the locker was set.
  const hasBoxnowLockerInCart = !!cart?.metadata?.boxnow_locker_id
  const hasEcontOfficeInCart = !!cart?.metadata?.econt_office_code

  const deliveryReady =
    (!!selectedShippingMethod ||
      (cart?.shipping_methods?.length ?? 0) > 0) &&
    (!selectedIsBoxnow || !!selectedBoxnowLocker || hasBoxnowLockerInCart) &&
    (!selectedIsEcont || !!selectedEcontOffice || hasEcontOfficeInCart)

  // Auto-initiate payment session when delivery is ready
  useEffect(() => {
    if (deliveryReady && !activePaymentSession) {
      const defaultTab = hasCod ? "cod" : hasCard ? "card" : null
      if (defaultTab) handlePaymentTab(defaultTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryReady])

  // Reconcile paymentTab with currently-available methods. When the
  // store's paymentMethodFilter strips a method in response to a shipping
  // change (e.g. BoxNow → no COD), the previously selected tab can point
  // to a method that's no longer rendered — leaving the remaining tab's
  // radio looking unselected and the form collapsed.
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

  const handlePaymentElementChange = useCallback(
    (_e: { complete: boolean; selectedMethod: string | null }) => {
      setPaymentError(null)
    },
    []
  )

  // ── 3DS / bank-redirect return handler ──────────────────────────────
  // Stripe Payment Element calls confirmPayment with redirect:
  // "if_required". For methods that require a redirect (3DS challenge,
  // bank-redirect APMs), the browser navigates to return_url and comes
  // back carrying ?payment_intent=...&redirect_status=...
  //
  // This handler:
  //   1. Validates `payment_intent` matches the cart's active payment
  //      session id. If the cart was rotated mid-redirect (different
  //      tab, cookie change), we abort instead of completing a cart
  //      whose payment_collection points elsewhere.
  //   2. On succeeded → calls placeOrder; on failure translates the
  //      error via translatePaymentError so a Bulgarian customer
  //      doesn't see raw Medusa English. Logs to checkout_error_log
  //      so we have operational visibility into 3DS failure rates.
  //   3. On non-succeeded redirect_status → translated copy + log.
  //
  // Strips query params before async work so a refresh / re-render
  // doesn't re-trigger this effect.
  const threeDSHandledRef = useRef(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (threeDSHandledRef.current) return

    const url = new URL(window.location.href)
    const redirectStatus = url.searchParams.get("redirect_status")
    const paymentIntentId = url.searchParams.get("payment_intent")
    if (!redirectStatus || !paymentIntentId) return

    threeDSHandledRef.current = true

    // Strip params immediately so refreshes don't re-fire.
    ;[
      "redirect_status",
      "payment_intent",
      "payment_intent_client_secret",
    ].forEach((k) => url.searchParams.delete(k))
    window.history.replaceState({}, "", url.toString())

    // Validate the PI matches the cart's active session. Mismatch =
    // cart was rotated mid-redirect; completing it would corrupt state.
    const sessionPi =
      (activePaymentSession?.data as { id?: string } | undefined)?.id ?? null
    if (sessionPi && sessionPi !== paymentIntentId) {
      const message =
        "Сесията за плащане не съвпада с поръчката. Моля, презаредете страницата и опитайте отново."
      setPaymentError(message)
      void logCheckoutError("place_order_error", "pi_mismatch", {
        via: "3ds_return",
        cartId: cart.id,
        sessionPi,
        paymentIntentId,
      })
      return
    }

    if (redirectStatus === "succeeded") {
      const tracking = resolvePlaceOrderTracking?.()
      placeOrder(undefined, tracking, orderConfirmedPath).catch(
        (err: unknown) => {
          const translated = translatePaymentError(err, "card")
          setPaymentError(translated)
          void logCheckoutError(
            "place_order_error",
            err instanceof Error ? err.message : String(err),
            {
              via: "3ds_return",
              cartId: cart.id,
              paymentIntentId,
            }
          )
        }
      )
    } else {
      setPaymentError(
        "Плащането не беше потвърдено. Моля, опитайте отново или изберете друг метод."
      )
      void logCheckoutError("place_order_error", "redirect_not_succeeded", {
        via: "3ds_return",
        cartId: cart.id,
        paymentIntentId,
        redirectStatus,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summaryCart = cart as HttpTypes.StoreCart & {
    promotions?: HttpTypes.StorePromotion[]
  }

  return {
    // Completed-cart guard
    cartIsCompleted,

    // Address form
    formData,
    setFormData,
    addressError,
    addressReady,
    allRequiredFilled,
    setFormAddress,
    handleFormChange,
    handleFieldBlur,
    addressInput,
    regionCountries,
    addressesInRegion,
    saveAddress,

    // Shipping
    shippingMethods,
    calculatedPricesMap,
    isLoadingPrices,
    selectedShippingMethod,
    selectedShippingOption,
    selectedFulfillmentOptionId,
    selectedIsBoxnow,
    selectedIsEcont,
    shippingLoading,
    shippingError,
    optimisticShippingCost,
    setOptimisticShippingCost,
    handleSelectShipping,

    // Carriers
    selectedEcontOffice,
    handleSelectEcontOffice,
    selectedBoxnowLocker,
    handleSelectBoxnowLocker,

    // Payment
    paymentTab,
    hasCard,
    hasCod,
    cardId,
    codId,
    paymentError,
    setPaymentError,
    deliveryReady,
    optimisticCodFee,
    setOptimisticCodFee,
    handlePaymentTab,
    handlePaymentElementChange,

    // Misc
    summaryCart,
  }
}
