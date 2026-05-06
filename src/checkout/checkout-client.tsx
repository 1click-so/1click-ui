"use client"

import type { HttpTypes } from "@medusajs/types"
import type { Appearance, StripeElementsOptions } from "@stripe/stripe-js"

import { CheckoutAddressForm } from "./address-form"
import { MobileCheckoutBottomBar } from "./mobile-checkout-bottom-bar"
import { MobileCheckoutTopBar } from "./mobile-checkout-top-bar"
import { OrderSummary } from "./order-summary"
import { CheckoutPaymentMethodList } from "./payment-method-list"
import { CheckoutShippingMethodList } from "./shipping-method-list"
import { PaymentWrapper } from "./payment-wrapper"
import { useCheckoutOrchestration } from "./use-checkout-orchestration"

/**
 * CheckoutClient — single-page checkout layout. The orchestration logic
 * (address state, shipping select, carrier metadata, payment-tab race
 * guards, 3DS return handling, completed-cart detection) lives in the
 * `useCheckoutOrchestration` hook so any store with a custom layout
 * (e.g. AlenikaCheckoutOrchestration) shares the same hardened state
 * machine and inherits future fixes automatically.
 *
 * Stores wanting a different layout should compose their own component
 * using the same hook + the same primitives — see
 * `useCheckoutOrchestration`'s docstring.
 */

type CheckoutClientProps = {
  cart: HttpTypes.StoreCart
  customer: HttpTypes.StoreCustomer | null
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
  availablePaymentMethods:
    | Array<HttpTypes.StorePaymentProvider | { id: string }>
    | null
  countryCode: string
  paymentMethodFilter?: (
    methods:
      | Array<HttpTypes.StorePaymentProvider | { id: string }>
      | null,
    selectedShippingOption: HttpTypes.StoreCartShippingOption | null
  ) =>
    | Array<HttpTypes.StorePaymentProvider | { id: string }>
    | null
  logoByFulfillmentOptionId?: Record<string, { src: string; alt: string }>
  /** Stripe Elements appearance + fonts forwarded to PaymentWrapper. */
  appearance?: Appearance
  fonts?: StripeElementsOptions["fonts"]
}

export function CheckoutClient({
  cart,
  customer,
  availableShippingMethods,
  availablePaymentMethods,
  countryCode,
  paymentMethodFilter,
  logoByFulfillmentOptionId,
  appearance,
  fonts,
}: CheckoutClientProps) {
  const o = useCheckoutOrchestration({
    cart,
    customer,
    availableShippingMethods,
    availablePaymentMethods,
    countryCode,
    paymentMethodFilter,
  })

  const buyButtonNotReady = !o.deliveryReady || !o.addressReady

  return (
    <PaymentWrapper
      cart={cart}
      amount={o.optimisticTotalCents}
      appearance={appearance}
      fonts={fonts}
    >
      {/* Mobile-only: collapsible order summary at the top. */}
      <MobileCheckoutTopBar
        cart={o.summaryCart}
        optimisticShippingCost={o.optimisticShippingCost}
        optimisticCodFee={o.optimisticCodFee}
      />

      <div className="max-w-[1140px] mx-auto px-5 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:justify-center gap-8 sm:gap-12">
          {/* ═══ LEFT: FORM ════════════════════════════════════════════ */}
          <div className="w-full sm:max-w-[480px]">
            <CheckoutAddressForm
              formData={o.formData}
              onChange={o.handleFormChange}
              onBlur={o.handleFieldBlur}
              savedAddresses={o.addressesInRegion ?? undefined}
              onSelectSavedAddress={o.setFormAddress}
              countries={o.regionCountries}
              addressInput={o.addressInput}
              addressError={o.addressError}
              pulseFields={o.pulseFields}
            />

            <CheckoutShippingMethodList
              shippingMethods={o.shippingMethods}
              selectedShippingMethodId={o.selectedShippingMethod}
              calculatedPricesMap={o.calculatedPricesMap}
              isLoadingPrices={o.isLoadingPrices}
              shippingLoading={o.shippingLoading}
              shippingError={o.shippingError}
              onSelect={o.handleSelectShipping}
              addressReady={o.addressReady}
              currencyCode={cart.currency_code}
              econt={{
                selectedOffice: o.selectedEcontOffice,
                onSelectOffice: o.handleSelectEcontOffice,
                userCity: o.formData["shipping_address.city"] ?? "",
                userAddress: o.formData["shipping_address.address_1"] ?? "",
              }}
              boxnow={{
                selectedLocker: o.selectedBoxnowLocker,
                onSelectLocker: o.handleSelectBoxnowLocker,
                userCity: o.formData["shipping_address.city"] ?? "",
                userAddress: o.formData["shipping_address.address_1"] ?? "",
              }}
              logoByFulfillmentOptionId={logoByFulfillmentOptionId}
            />

            <CheckoutPaymentMethodList
              cart={cart}
              hasCard={o.hasCard}
              hasCod={o.hasCod}
              paymentTab={o.paymentTab}
              onPaymentTab={o.handlePaymentTab}
              deliveryReady={o.deliveryReady}
              paymentError={o.paymentError}
              onPaymentElementChange={o.handlePaymentElementChange}
              performBuyClick={o.performBuyClick}
              buyButtonNotReady={buyButtonNotReady}
              total={o.optimisticTotal}
              beforePaymentButton={
                <MobileCheckoutBottomBar
                  cart={o.summaryCart}
                  optimisticShippingCost={o.optimisticShippingCost}
                  optimisticCodFee={o.optimisticCodFee}
                />
              }
            />
          </div>

          {/* ═══ RIGHT: ORDER SUMMARY (desktop only) ═══════════════════ */}
          <div className="hidden sm:block sm:w-[420px] flex-shrink-0">
            <div className="sm:sticky sm:top-6">
              <OrderSummary
                cart={o.summaryCart}
                optimisticShippingCost={o.optimisticShippingCost}
                onOptimisticShippingClear={() =>
                  o.setOptimisticShippingCost(null)
                }
                optimisticCodFee={o.optimisticCodFee}
                onOptimisticCodFeeClear={() => o.setOptimisticCodFee(null)}
              />
            </div>
          </div>
        </div>
      </div>
    </PaymentWrapper>
  )
}
