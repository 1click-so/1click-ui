/**
 * Cart drawer labels — default English copy.
 *
 * Every user-facing string in the cart drawer comes from a `CartDrawerLabels`
 * object. Stores override strings by passing a partial labels object to
 * `CartDrawerProvider`. English is the baseline; stores wanting Bulgarian,
 * German, etc. pass their own translations.
 */

export type CartDrawerLabels = {
  // Header
  yourCart: string
  item: string
  items: string
  closeCart: string

  // Empty state
  emptyCartTitle: string
  emptyCartMessage: string
  browseProducts: string

  // Tiered progress
  awayFromFreeShipping: string
  allRewardsUnlocked: string

  // Gift wrap / notes
  addGiftWrap: string
  giftNote: string
  orderNote: string
  giftNotePlaceholder: string
  orderNotePlaceholder: string

  // Rewards
  estimatedRewardPoints: string

  // Cross-sell
  pairsWellWith: string
  youllLoveThis: string
  youMightAlsoLike: string
  addToCart: string

  // Summary / footer
  subtotal: string
  taxAndShipping: string
  shipping: string
  free: string
  calculatedAtCheckout: string
  total: string
  secureCheckout: string
  shippingAndTaxCalculatedAtCheckout: string

  // Continue shopping
  continueShopping: string

  // A11y / buttons
  remove: string
}

export const defaultCartDrawerLabels: CartDrawerLabels = {
  yourCart: "Your cart",
  item: "item",
  items: "items",
  closeCart: "Close cart",

  emptyCartTitle: "Your cart is empty",
  emptyCartMessage: "You haven't added any products yet.",
  browseProducts: "Browse products",

  awayFromFreeShipping: "away from free shipping",
  allRewardsUnlocked: "All rewards unlocked",

  addGiftWrap: "Add gift wrapping",
  giftNote: "Gift note",
  orderNote: "Order note",
  giftNotePlaceholder: "Add a personal message...",
  orderNotePlaceholder: "Special instructions for this order...",

  estimatedRewardPoints: "Estimated reward points",

  pairsWellWith: "Pairs well with",
  youllLoveThis: "You'll love this",
  youMightAlsoLike: "You might also like",
  addToCart: "Add",

  subtotal: "Subtotal",
  taxAndShipping: "VAT included. Shipping calculated at checkout.",
  shipping: "Shipping",
  free: "FREE",
  calculatedAtCheckout: "Calculated at checkout",
  total: "Total",
  secureCheckout: "Checkout",
  shippingAndTaxCalculatedAtCheckout: "Shipping and tax calculated at checkout",

  continueShopping: "Continue shopping",

  remove: "Remove",
}
