/**
 * Checkout labels — default English copy.
 *
 * Every user-facing string in the checkout module comes from a
 * `CheckoutLabels` object. Stores override strings by passing a partial
 * labels object to `CheckoutProvider`. English is the baseline; stores
 * wanting Bulgarian, German, etc. pass their own translations.
 */

export type CheckoutLabels = {
  // Section headings
  deliveryInfo: string
  shippingServices: string
  paymentMethod: string
  orderSummary: string

  // Form fields
  email: string
  country: string
  firstName: string
  lastName: string
  address: string
  apartment: string
  city: string
  postalCode: string
  phone: string
  province: string

  // Buttons
  saveAddress: string
  updateAddress: string
  addToOrder: string
  addCode: string

  // States / empty / disabled
  deliveryDisabled: string
  noShippingOptions: string
  paymentDisabled: string

  // Payment tabs + card fields
  cardDetails: string
  cardNumber: string
  cardExpiry: string
  cardCvc: string
  codNote: string
  payByCard: string
  cashOnDelivery: string
  termsText: string

  // Address reuse
  useSavedAddress: string
  saveInfo: string

  // Saved address picker
  chooseAddress: string

  // Order summary
  items: string
  qty: string
  subtotal: string
  shipping: string
  shippingCalc: string
  shippingFree: string
  tax: string
  taxTooltip: string
  total: string
  discount: string
  discountCode: string
  discountSub: string
  recommended: string
  recommendedSoon: string
  recommendedSoonSub: string
  remove: string
  secureCheckout: string

  // Company invoice
  companyInvoice: string
  companyName: string
  companyVat: string
  companyMol: string
  companyAddress: string

  // Place order button
  placeOrder: string
  selectPaymentMethod: string

  // Econt office selector
  econtLoadingOffices: string
  econtNearestOffices: string
  econtSearchAnother: string
  econtSearchPlaceholder: string
  econtNoResults: string
  econtChange: string

  // BoxNow locker selector
  boxnowLoadingLockers: string
  boxnowNearestLockers: string
  boxnowSearchAnother: string
  boxnowSearchPlaceholder: string
  boxnowNoResults: string
  boxnowChange: string
  boxnowUnavailable: string
}

export const defaultCheckoutLabels: CheckoutLabels = {
  deliveryInfo: "Delivery information",
  shippingServices: "Shipping method",
  paymentMethod: "Payment method",
  orderSummary: "Order summary",

  email: "Email",
  country: "Country",
  firstName: "First name",
  lastName: "Last name",
  address: "Address",
  apartment: "Apartment, suite, etc. (optional)",
  city: "City",
  postalCode: "Postal code",
  phone: "Phone",
  province: "State / province",

  saveAddress: "Save and continue",
  updateAddress: "Update address",
  addToOrder: "+ Add to order",
  addCode: "Apply",

  deliveryDisabled:
    "Enter your delivery address to see available shipping options.",
  noShippingOptions: "No shipping options available for your address.",
  paymentDisabled: "Select a shipping method to continue.",

  cardDetails: "Card details",
  cardNumber: "Card number",
  cardExpiry: "Expiry (MM/YY)",
  cardCvc: "Security code",
  codNote: "Cash on delivery. Additional fees may apply.",
  payByCard: "Pay by card",
  cashOnDelivery: "Cash on delivery",
  termsText:
    "By placing your order you accept our Terms and Privacy Policy.",

  useSavedAddress: "Use a saved address?",
  saveInfo: "Save this information for next time",

  chooseAddress: "Choose an address",

  items: "items",
  qty: "Qty",
  subtotal: "Subtotal",
  shipping: "Shipping",
  shippingCalc: "Calculated at checkout",
  shippingFree: "Free",
  tax: "VAT incl.",
  taxTooltip: "20% VAT is included in prices",
  total: "Total",
  discount: "Discount",
  discountCode: "Discount code",
  discountSub: "Save with a promo code",
  recommended: "Recommended for you",
  recommendedSoon: "Coming soon",
  recommendedSoonSub: "Personalized recommendations",
  remove: "Remove",
  secureCheckout: "Secure checkout",

  companyInvoice: "Company invoice",
  companyName: "Company name",
  companyVat: "VAT / Company number",
  companyMol: "Responsible person",
  companyAddress: "Company address",

  placeOrder: "Place order",
  selectPaymentMethod: "Select a payment method",

  econtLoadingOffices: "Loading offices...",
  econtNearestOffices: "Nearest offices",
  econtSearchAnother: "Search for another office",
  econtSearchPlaceholder: "Search by name, city, or address...",
  econtNoResults: "No offices found for",
  econtChange: "Change",

  boxnowLoadingLockers: "Loading lockers...",
  boxnowNearestLockers: "Nearest lockers",
  boxnowSearchAnother: "Search for another locker",
  boxnowSearchPlaceholder: "Search by name, address, or postal code...",
  boxnowNoResults: "No lockers found for",
  boxnowChange: "Change",
  boxnowUnavailable:
    "BoxNow is temporarily unavailable, please choose a different shipping method.",
}
