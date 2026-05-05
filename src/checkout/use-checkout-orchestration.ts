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
  logCheckoutError,
  placeOrder,
  prepareCheckout,
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
 *
 * `shipping_address.phone` is required — Bulgarian carriers (Econt,
 * BoxNow) need it to contact the customer; it's the courier's primary
 * recovery channel when the address is ambiguous.
 */
const REQUIRED_ADDRESS_FIELDS = [
  "email",
  "shipping_address.country_code",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.address_1",
  "shipping_address.city",
  "shipping_address.postal_code",
  "shipping_address.phone",
] as const

/**
 * Debounce window for the auto-save effect — long enough that a user
 * typing through fields without blurring triggers ONE save at the end,
 * short enough that clicking a shipping option after the last keystroke
 * doesn't race the persistence (the pre-action `flushAddressSave` is
 * the belt-and-braces backstop for that race).
 */
const ADDRESS_AUTO_SAVE_DEBOUNCE_MS = 600

/**
 * Snapshot the address-relevant subset of formData. Used to skip
 * redundant saves: if the snapshot matches what was last persisted,
 * there's nothing to do. JSON-stringify keeps comparison cheap and
 * correct (string keys + string values, no nested objects).
 */
function snapshotAddressForm(
  formData: Record<string, string>,
  sameAsBilling: boolean
): string {
  return JSON.stringify({
    email: formData.email ?? "",
    first_name: formData["shipping_address.first_name"] ?? "",
    last_name: formData["shipping_address.last_name"] ?? "",
    address_1: formData["shipping_address.address_1"] ?? "",
    company: formData["shipping_address.company"] ?? "",
    postal_code: formData["shipping_address.postal_code"] ?? "",
    city: formData["shipping_address.city"] ?? "",
    country_code: formData["shipping_address.country_code"] ?? "",
    province: formData["shipping_address.province"] ?? "",
    phone: formData["shipping_address.phone"] ?? "",
    company_name: formData.company_name ?? "",
    company_vat: formData.company_vat ?? "",
    company_mol: formData.company_mol ?? "",
    company_address: formData.company_address ?? "",
    sameAsBilling,
  })
}

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
  // Snapshot of the formData that was last successfully persisted.
  // Used to skip redundant saves and to detect when the user changed
  // form fields while a save was in flight (so we re-fire after).
  const lastSavedSnapshotRef = useRef<string>("")
  // When a save is in flight and formData changes, we set this to the
  // latest snapshot. The in-flight save's `finally` checks it and
  // re-fires saveAddress so the latest form state always wins.
  const pendingSnapshotRef = useRef<string | null>(null)

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

  // First-render seed of lastSavedSnapshotRef. When a returning user
  // lands on /checkout with a cart that already has email + shipping
  // address persisted server-side, formData initializes from the cart
  // and matches what's already saved. Without this seed, the auto-save
  // effect sees ref="" (not yet seeded) vs a populated snapshot and
  // schedules a redundant `updateCart` 600ms after mount. That fires
  // before the auto-init payment-session effect can complete its
  // `flushAddressSave` await, so the Place Order button render gets
  // delayed by a full updateCart round-trip on every checkout reload.
  //
  // Guard with `cart?.email && cart?.shipping_address?.first_name` so
  // we only seed when the cart genuinely has the data persisted; a
  // half-populated cart leaves ref="" so the user's first save fires
  // normally.
  const snapshotSeededRef = useRef(false)
  if (
    !snapshotSeededRef.current &&
    allRequiredFilled &&
    cart?.email &&
    cart?.shipping_address?.first_name
  ) {
    snapshotSeededRef.current = true
    lastSavedSnapshotRef.current = snapshotAddressForm(formData, sameAsBilling)
  }

  const saveAddress = useCallback(async () => {
    if (!allRequiredFilled) return
    const snapshot = snapshotAddressForm(formData, sameAsBilling)
    // Skip redundant saves — if the form hasn't changed since last
    // successful persist, don't re-hit the network. Critical for the
    // debounced auto-save: every formData change triggers the effect,
    // but only meaningful changes should reach the server.
    if (snapshot === lastSavedSnapshotRef.current) return
    // If a save is already in flight, register this snapshot as
    // pending. The in-flight save's `finally` will re-fire saveAddress
    // so the latest form state always wins. Without this, formData
    // edits that happen during a save get silently dropped.
    if (addressSavingRef.current) {
      pendingSnapshotRef.current = snapshot
      return
    }
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
      lastSavedSnapshotRef.current = snapshot

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
      // If formData changed during the save, fire again with the
      // latest state. Loops at most once per real user edit because
      // the snapshot guard skips duplicates.
      const pending = pendingSnapshotRef.current
      pendingSnapshotRef.current = null
      if (pending && pending !== lastSavedSnapshotRef.current) {
        void saveAddressRef.current?.()
      }
    }
  }, [formData, allRequiredFilled, sameAsBilling, customer, cart?.metadata])

  // Self-reference for the post-save re-fire path. Captured via ref so
  // the callback can call the latest version of itself without making
  // useCallback's dep list circular.
  const saveAddressRef = useRef(saveAddress)
  useEffect(() => {
    saveAddressRef.current = saveAddress
  }, [saveAddress])

  // ── Auto-save effect ───────────────────────────────────────────────
  // The single source of truth for "form data → server cart" sync.
  // Watches formData and fires saveAddress after a debounce window.
  // This is what makes the persistence robust to:
  //   - Browser autofill (1Password, Bitwarden, Chrome) which can fill
  //     multiple fields without firing per-field blur events
  //   - sessionStorage form restore on mount (the storefront's "I
  //     refreshed and my form is still filled" UX)
  //   - Programmatic / paste-driven fills with no blur
  //   - Saved-customer-address selection (setFormAddress)
  //
  // Before this effect, persistence relied on `handleFieldBlur` —
  // which made the cart silently empty whenever the form got filled
  // by a non-blur path. That's the bug that left cart.email NULL on
  // anonymous carts and kept the Place Order button disabled even
  // when the form looked complete.
  //
  // `handleFieldBlur` is preserved as the immediate-save shortcut so
  // the typical typing path doesn't wait for the debounce.
  useEffect(() => {
    if (!allRequiredFilled) return
    const snapshot = snapshotAddressForm(formData, sameAsBilling)
    if (snapshot === lastSavedSnapshotRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void saveAddress()
    }, ADDRESS_AUTO_SAVE_DEBOUNCE_MS)
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [formData, allRequiredFilled, sameAsBilling, saveAddress])

  // flushAddressSave — used by shipping/payment selection handlers to
  // guarantee the latest form state is persisted BEFORE a state-
  // advancing mutation runs. Cancels any pending debounce and awaits
  // the save synchronously. Without this, a fast user (clicks Econt
  // < 600ms after their last keystroke) advances on a stale cart.
  const flushAddressSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (!allRequiredFilled) return
    await saveAddress()
  }, [allRequiredFilled, saveAddress])

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

  // Carrier metadata is held in client state ONLY and written to the cart
  // exactly once at Buy click via prepareCheckout. No eager updateCart on
  // selection — that path was the source of the office-vs-direct-address
  // and BoxNow-vs-Econt mismatched-data bugs.
  const handleSelectEcontOffice = useCallback(
    (office: EcontOffice | null) => {
      setSelectedEcontOffice(office)
    },
    []
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
    },
    []
  )

  // ── Payment ─────────────────────────────────────────────────────────
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

  // Default tab: card when available, else COD. The eager-session model
  // used to seed from the cart's pending session provider; in the
  // deferred-intent model there is no session at mount.
  const [paymentTab, setPaymentTab] = useState<"card" | "cod">(
    hasCard ? "card" : "cod"
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

  // Payment tab selection is client state only. No payment session is
  // created until Buy click. This eliminates the entire class of
  // session-rotation / amount-drift / iframe-remount bugs caused by the
  // old eager-session model.
  const handlePaymentTab = useCallback(
    (tab: "card" | "cod") => {
      setPaymentTab(tab)
      setPaymentError(null)

      // Optimistic COD-fee prediction so the totals row updates instantly.
      // Currency must match the configured fee currency or the backend
      // skips the fee at apply time, so we mirror that gate here.
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
    },
    [cart.currency_code, codConfig]
  )

  // Shipping selection is client state only. No setShippingMethod call,
  // no metadata-clear updateCart, no syncPaymentAmount — all of those
  // wrote to the cart between toggles and produced the stale-data
  // bug class. The shipping method ID is sent to the backend exactly
  // once at Buy click via prepareCheckout.
  const handleSelectShipping = useCallback(
    (id: string) => {
      setShippingError(null)
      setSelectedShippingMethod(id)

      // Optimistic shipping cost — paint the totals row immediately so
      // the customer sees the right number before any network call.
      const option = shippingMethods.find((m) => m.id === id)
      if (option) {
        const price =
          option.price_type === "flat"
            ? option.amount
            : calculatedPricesMap[option.id]
        if (price !== undefined) setOptimisticShippingCost(price)
      }

      // Switching shipping invalidates any previously-selected carrier-
      // specific destination (e.g. picking direct address after BoxNow
      // locker). All client state — no eager metadata-clear updateCart.
      setSelectedBoxnowLocker(null)
      setSelectedEcontOffice(null)
    },
    [shippingMethods, calculatedPricesMap]
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

  // Reconcile paymentTab with currently-available methods. When the
  // store's paymentMethodFilter strips a method in response to a shipping
  // change (e.g. BoxNow → no COD), the previously selected tab can point
  // to a method that's no longer rendered — leaving the remaining tab's
  // radio looking unselected and the form collapsed.
  useEffect(() => {
    if (!deliveryReady) return
    if (paymentTab === "cod" && !hasCod && hasCard) {
      handlePaymentTab("card")
    } else if (paymentTab === "card" && !hasCard && hasCod) {
      handlePaymentTab("cod")
    }
  }, [deliveryReady, paymentTab, hasCard, hasCod, handlePaymentTab])

  const handlePaymentElementChange = useCallback(
    (_e: { complete: boolean; selectedMethod: string | null }) => {
      setPaymentError(null)
    },
    []
  )

  // ── 3DS / bank-redirect return handler ──────────────────────────────
  // Stripe confirmPayment with redirect: "if_required" navigates to
  // return_url ONLY when the method demands it (3DS challenge, bank-
  // redirect APMs). On return the browser carries
  //   ?payment_intent=...&redirect_status=succeeded|...
  //
  // In the deferred-intent flow, the PaymentIntent was created at Buy
  // click via prepareCheckout; the cart already has a pending session
  // pointing at that PI. After 3DS succeeds the PI is in
  // requires_capture / succeeded — completeCart can authorize. We just
  // call placeOrder (= /complete).
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

    ;[
      "redirect_status",
      "payment_intent",
      "payment_intent_client_secret",
    ].forEach((k) => url.searchParams.delete(k))
    window.history.replaceState({}, "", url.toString())

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

  // ── Optimistic total (for Stripe Elements deferred-intent mode) ─────
  // Stripe's deferred-intent <Elements> needs `amount` + `currency` at
  // mount time (no PaymentIntent on the backend yet). We compute the
  // displayed total from cart.subtotal + tax + optimistic shipping +
  // optimistic COD fee. Reflects what the customer sees in the order
  // summary, so the iframe's "Pay €X" matches it.
  //
  // amount is in the smallest currency unit (cents/stotinki). Round to
  // protect against float drift in optimistic deltas.
  const optimisticTotalCents = useMemo(() => {
    const cartSubtotal = cart?.subtotal ?? 0
    const cartTaxTotal = cart?.tax_total ?? 0
    const cartShipping = cart?.shipping_total ?? 0
    const cartTotal = cart?.total ?? 0
    // Prefer the optimistic shipping when set (toggle just happened);
    // otherwise fall back to whatever the cart already has (e.g. a
    // returning user with persisted shipping_methods, though in the
    // deferred model that won't happen until Buy click).
    const shippingCost =
      optimisticShippingCost !== null ? optimisticShippingCost : cartShipping
    const codFee = optimisticCodFee ?? 0

    // If we have any optimistic delta, recompute from parts. Otherwise
    // trust cart.total (covers tax adjustments correctly during typing).
    const computedTotal =
      optimisticShippingCost !== null || optimisticCodFee !== null
        ? cartSubtotal + cartTaxTotal + shippingCost + codFee
        : cartTotal

    return Math.max(50, Math.round(computedTotal * 100))
  }, [
    cart?.subtotal,
    cart?.tax_total,
    cart?.shipping_total,
    cart?.total,
    optimisticShippingCost,
    optimisticCodFee,
  ])

  // ── Buy-click payload builder ───────────────────────────────────────
  // Constructs the prepareCheckout request body from current client
  // state. Called by PaymentButton on click.
  const buildPrepareCheckoutPayload = useCallback(() => {
    const carrierMetadata: Record<string, unknown> = {}
    if (selectedEcontOffice) {
      const addr = [
        selectedEcontOffice.address?.street,
        selectedEcontOffice.address?.num,
      ]
        .filter(Boolean)
        .join(" ")
      carrierMetadata.econt_office_code = selectedEcontOffice.code
      carrierMetadata.econt_office_name = selectedEcontOffice.name
      carrierMetadata.econt_office_city =
        selectedEcontOffice.address?.city?.name || ""
      carrierMetadata.econt_office_address = addr
      carrierMetadata.econt_office_phone =
        selectedEcontOffice.phones?.[0] || ""
    }
    if (selectedBoxnowLocker) {
      carrierMetadata.boxnow_locker_id = selectedBoxnowLocker.id
      carrierMetadata.boxnow_locker_title = selectedBoxnowLocker.title
      carrierMetadata.boxnow_locker_address =
        selectedBoxnowLocker.addressLine1 ?? ""
      carrierMetadata.boxnow_locker_postal =
        selectedBoxnowLocker.postalCode ?? ""
    }

    const shippingMethodId = selectedShippingMethod
    if (!shippingMethodId) {
      throw new Error("No shipping method selected")
    }
    const paymentProvider = paymentTab === "card" ? cardId : codId
    if (!paymentProvider) {
      throw new Error("No payment provider available")
    }

    return {
      shipping_address: {
        first_name: formData["shipping_address.first_name"] ?? "",
        last_name: formData["shipping_address.last_name"] ?? "",
        address_1: formData["shipping_address.address_1"] ?? "",
        address_2: "",
        city: formData["shipping_address.city"] ?? "",
        postal_code: formData["shipping_address.postal_code"] ?? "",
        country_code: formData["shipping_address.country_code"] ?? "",
        phone: formData["shipping_address.phone"] ?? "",
      },
      shipping_method_id: shippingMethodId,
      carrier_metadata: carrierMetadata,
      payment_provider: paymentProvider,
    }
  }, [
    formData,
    selectedShippingMethod,
    selectedEcontOffice,
    selectedBoxnowLocker,
    paymentTab,
    cardId,
    codId,
  ])

  // ── Buy click ───────────────────────────────────────────────────────
  // Single source of truth for the Buy-click flow. Called by PaymentButton.
  // Steps:
  //   1. Flush any pending address auto-save (so Medusa has the latest
  //      email/name/phone for tracking + abandoned-cart).
  //   2. (Card path) elements.submit() — validates the form inside the
  //      Stripe iframe before any server call.
  //   3. POST /store/carts/:id/prepare-checkout — atomic write of
  //      address/shipping/COD-fee + create PaymentIntent.
  //   4. (Card path) stripe.confirmPayment(elements, clientSecret) —
  //      attaches the payment method and confirms. On 3DS this redirects
  //      and we resume in the threeDSHandledRef effect.
  //   5. placeOrder() (Medusa's standard /cart/:id/complete) — creates
  //      the order. authorizePaymentSession passes because the PI is
  //      now in requires_capture / succeeded.
  type BuyClickStripe = {
    submit: () => Promise<{ error?: { message?: string } | null }>
    stripe: {
      confirmPayment: (args: {
        elements: unknown
        clientSecret: string
        confirmParams: { return_url: string }
        redirect: "if_required"
      }) => Promise<{ error?: { message?: string } | null }>
    }
    elements: unknown
  }

  const performBuyClick = useCallback(
    async (stripeBundle?: BuyClickStripe): Promise<void> => {
      setPaymentError(null)

      await flushAddressSave()

      if (paymentTab === "card") {
        if (!stripeBundle) {
          throw new Error("Stripe not ready")
        }
        const { error: submitError } = await stripeBundle.submit()
        if (submitError) {
          throw submitError
        }
      }

      const payload = buildPrepareCheckoutPayload()
      const prep = await prepareCheckout(cart.id, payload)

      if (paymentTab === "card") {
        if (!stripeBundle || !prep.client_secret) {
          throw new Error("Stripe client_secret missing after prepare")
        }
        const returnUrl =
          typeof window !== "undefined" ? window.location.href : ""
        const { error } = await stripeBundle.stripe.confirmPayment({
          elements: stripeBundle.elements,
          clientSecret: prep.client_secret,
          confirmParams: { return_url: returnUrl },
          redirect: "if_required",
        })
        if (error) {
          throw error
        }
      }

      const tracking = resolvePlaceOrderTracking?.()
      await placeOrder(undefined, tracking, orderConfirmedPath)
    },
    [
      cart.id,
      paymentTab,
      flushAddressSave,
      buildPrepareCheckoutPayload,
      orderConfirmedPath,
      resolvePlaceOrderTracking,
    ]
  )

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

    // Buy click (deferred-intent flow)
    optimisticTotalCents,
    buildPrepareCheckoutPayload,
    performBuyClick,

    // Misc
    summaryCart,
  }
}
