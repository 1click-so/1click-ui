import type { CartDrawerLabels } from "./labels"

/**
 * Bulgarian translations for the cart drawer.
 *
 * Ships alongside the English defaults so Bulgarian stores get the
 * translated copy with a single import instead of hand-writing every
 * string. Strings match the originals from mindpages-storefront.
 *
 * Usage in a store's layout:
 *
 *   import {
 *     CartDrawerProvider,
 *     bulgarianCartDrawerLabels,
 *   } from "@1click/ui/cart-drawer"
 *
 *   <CartDrawerProvider cart={cart} labels={bulgarianCartDrawerLabels}>
 *     ...
 *   </CartDrawerProvider>
 *
 * For multi-language stores, pick the matching labels object at render
 * time based on the active locale (see `data/locale-actions.ts` for
 * reading/writing the locale cookie).
 */

export const bulgarianCartDrawerLabels: CartDrawerLabels = {
  yourCart: "Вашата кошница",
  item: "артикул",
  items: "артикула",
  closeCart: "Затвори кошницата",

  emptyCartTitle: "Кошницата е празна",
  emptyCartMessage: "Все още нямате добавени продукти.",
  browseProducts: "Разгледай продуктите",

  awayFromFreeShipping: "до безплатна доставка",
  allRewardsUnlocked: "Всички награди са отключени",

  addGiftWrap: "Добави подаръчна опаковка",
  giftNote: "Картичка",
  orderNote: "Бележка",
  giftNotePlaceholder: "Добави лично съобщение...",
  orderNotePlaceholder: "Специални инструкции за поръчката...",

  estimatedRewardPoints: "Очаквани точки за награда",

  pairsWellWith: "Подходящи допълнения",
  youllLoveThis: "Ще ви хареса",
  youMightAlsoLike: "Може да ви хареса",
  addToCart: "Добави",

  subtotal: "Междинна сума",
  taxAndShipping: "С включен ДДС. Доставката се изчислява при плащане.",
  shipping: "Доставка",
  free: "БЕЗПЛАТНА",
  calculatedAtCheckout: "Изчислява се при плащане",
  total: "Общо",
  secureCheckout: "Към поръчка",
  shippingAndTaxCalculatedAtCheckout:
    "Доставката и данъкът се изчисляват при плащане",

  continueShopping: "Продължи пазаруването",

  remove: "Премахни",
}
