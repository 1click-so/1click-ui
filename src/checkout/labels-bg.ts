import type { CheckoutLabels } from "./labels"

/**
 * Bulgarian translations for the checkout.
 *
 * Ships alongside the English defaults. Strings match the originals
 * from mindpages-storefront's checkout-client monolith.
 *
 * Usage in a store's checkout page:
 *
 *   import {
 *     CheckoutProvider,
 *     bulgarianCheckoutLabels,
 *   } from "@1click/ui/checkout"
 *
 *   <CheckoutProvider labels={bulgarianCheckoutLabels}>
 *     <CheckoutClient ... />
 *   </CheckoutProvider>
 */

export const bulgarianCheckoutLabels: CheckoutLabels = {
  deliveryInfo: "Информация за доставка",
  shippingServices: "Начин на доставка",
  paymentMethod: "Начин на плащане",
  orderSummary: "Обобщение на поръчката",

  email: "Имейл",
  country: "Държава",
  singleCountryName: "България",
  firstName: "Собствено име",
  lastName: "Фамилно име",
  address: "Адрес",
  apartment: "Етаж, апартамент и т.н. (незадължително)",
  city: "Град",
  postalCode: "Пощенски код",
  phone: "Телефон",
  province: "Област",

  saveAddress: "Запази и продължи",
  updateAddress: "Обнови адреса",
  addToOrder: "+ Добави към поръчката",
  addCode: "Приложи",

  deliveryDisabled:
    "Въведете адреса си за доставка, за да видите наличните варианти за доставяне.",
  noShippingOptions: "Няма налични опции за доставка за вашия адрес.",
  paymentDisabled: "Изберете начин на доставка, за да продължите.",

  codNote: "Плащане при доставка. Възможна е допълнителна такса.",
  payOnline: "Плащане онлайн",
  cashOnDelivery: "Наложен платеж",
  termsText:
    "С поръчката си приемате нашите Общи условия и Политика за поверителност.",

  useSavedAddress: "Използвайте запазен адрес?",
  saveInfo: "Запазване на тази информация за следващия път",

  chooseAddress: "Изберете адрес",

  items: "артикула",
  qty: "Кол.",
  subtotal: "Междинна сума",
  shipping: "Доставка",
  shippingCalc: "Ще бъде изчислена",
  shippingFree: "Безплатна",
  tax: "Вкл. ДДС",
  taxTooltip: "ДДС 20% е включен в цените",
  total: "Обща сума",
  discount: "Отстъпка",
  discountCode: "Код за отстъпка",
  discountSub: "Спестете с промо код",
  recommended: "Препоръчано за вас",
  recommendedSoon: "Скоро тук",
  recommendedSoonSub: "Персонализирани предложения за вас",
  remove: "Премахни",
  secureCheckout: "Защитено плащане",

  companyInvoice: "Фактура за фирма",
  companyName: "Име на фирма",
  companyVat: "ЕИК / Булстат",
  companyMol: "МОЛ (материално отговорно лице)",
  companyAddress: "Адрес на фирма",

  placeOrder: "Поръчай",
  selectPaymentMethod: "Изберете начин на плащане",

  econtLoadingOffices: "Зареждане на офиси...",
  econtNearestOffices: "Най-близки офиси",
  econtSearchAnother: "Търси друг офис",
  econtSearchPlaceholder: "Търси по име, град или адрес...",
  econtNoResults: "Няма намерени офиси за",
  econtChange: "Промени",

  boxnowLoadingLockers: "Зареждане на автомати...",
  boxnowNearestLockers: "Най-близки автомати",
  boxnowSearchAnother: "Търси друг автомат",
  boxnowSearchPlaceholder: "Търси по име, адрес или пощенски код...",
  boxnowNoResults: "Няма намерени автомати за",
  boxnowChange: "Промени",
  boxnowUnavailable:
    "BoxNow временно е недостъпен, моля изберете друг метод за доставка.",
  boxnowNoLockersInCity:
    "Няма BoxNow автомати във вашия град. Моля изберете друг метод за доставка.",
}
