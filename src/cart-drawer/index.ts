// @1click/ui/cart-drawer — barrel export
//
// Re-exports every cart drawer primitive + the optional default assembly.
// Stores can import from this subpath:
//
//   import {
//     CartDrawerProvider,
//     CartDrawer,
//     CartDrawerHeader,
//     CartItem,
//     CartStickyFooter,
//     CartDrawerTemplate,
//   } from "@1click/ui/cart-drawer"

export {
  CartDrawerProvider,
  useCartDrawer,
} from "./context"
export {
  defaultCartDrawerLabels,
  type CartDrawerLabels,
} from "./labels"

export { CartDrawer } from "./cart-drawer"
export { CartDrawerHeader } from "./header"
export { CartPromoBanner } from "./promo-banner"
export { CartTieredProgress, type CartTier } from "./tiered-progress"
export { CartItem } from "./item"
export { CartItemQuantity } from "./item/quantity"
export { CartItemVariant } from "./item/variant"
export { CartItemUpsell, type UpsellProduct } from "./item/upsell"
export { CartFreeGift } from "./free-gift"
export { CartGiftWrap } from "./gift-wrap"
export { CartNotes } from "./notes"
export { CartRewardsPoints } from "./rewards-points"
export {
  CartCrossSellSidebar,
  type CrossSellSidebarProduct,
} from "./cross-sell-sidebar"
export {
  CartCrossSellCarousel,
  type CrossSellCarouselProduct,
} from "./cross-sell-carousel"
export { CartSummaryBreakdown } from "./summary-breakdown"
export { CartStickyFooter } from "./sticky-footer"
export { CartPaymentBadges } from "./payment-badges"
export { CartContinueShopping } from "./continue-shopping"
export { CartEmpty } from "./empty"
export { CartDrawerTemplate, type CartDrawerConfig } from "./template"
