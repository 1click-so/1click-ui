export type OrderLabels = {
  orderConfirmed: string
  confirmationSent: string
  orderNumber: string
  orderDate: string
  summary: string
  subtotal: string
  shipping: string
  discount: string
  tax: string
  total: string
  contactInfo: string
  delivery: string
  paymentMethod: string
  paymentMethodTitles: {
    card: string
    cod: string
    paypal: string
  }
  needHelp: string
  contactUs: string
  returnsExchanges: string
  orderPlaced: string
  processing: string
  shipped: string
  delivered: string
  free: string
  continueShopping: string
  qty: string
}

export const defaultOrderLabels: OrderLabels = {
  orderConfirmed: "Order confirmed",
  confirmationSent: "We sent a confirmation to",
  orderNumber: "Order",
  orderDate: "Date",
  summary: "Order summary",
  subtotal: "Subtotal",
  shipping: "Shipping",
  discount: "Discount",
  tax: "Tax",
  total: "Total",
  contactInfo: "Contact info",
  delivery: "Delivery",
  paymentMethod: "Payment method",
  paymentMethodTitles: {
    card: "Credit / debit card",
    cod: "Cash on delivery",
    paypal: "PayPal",
  },
  needHelp: "Need help?",
  contactUs: "Contact us",
  returnsExchanges: "Returns & exchanges",
  orderPlaced: "Placed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  free: "FREE",
  continueShopping: "Continue shopping",
  qty: "qty.",
}
