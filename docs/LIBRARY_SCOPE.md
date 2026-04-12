# Library Scope

Concrete plan for what gets extracted from `mindpages-storefront` into this library, in what order, and why. Every entry maps a source file in mindpages-storefront to its target location in this library, with notes on what has to change during extraction.

## Guiding principles

1. **Extract rhetorical e-commerce components immediately.** Product cards, PDP, checkout, cart — every store needs these. Don't wait for a second store to know they're universal.
2. **Extract store-specific features on second sighting.** Wishlists, loyalty programs, referral widgets — build in the store that needs it, extract when a second store does too.
3. **Decompose during extraction.** The 1684-line checkout monolith was broken into 17 focused files, not copied wholesale.
4. **Fix known issues during extraction.** The dynamic `require()` in checkout, the duplicate `DualPrice`, the fake fallback cross-sell products — all cleaned up when the code moved.

## Extraction phases

### Phase 0 — Foundations (before any component moves)

These are prerequisites. No component extraction happens until these are in place.

- Library repo skeleton: `package.json` (Bun project), `tsconfig.json`, `tailwind-preset.js`, entry files per subpath export. **No bundler** — the library is source-shipped, `.tsx` files are the deliverable.
- Install shadcn/ui dependencies: Radix primitives (`@radix-ui/react-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-accordion`, `@radix-ui/react-collapsible`, `@radix-ui/react-dropdown-menu`, etc. — installed as needed per component), `class-variance-authority`, `tailwind-merge`, `clsx`, `lucide-react` for icons.
- Copy shadcn/ui base components (`button`, `input`, `select`, `dialog`, `sheet`, `tabs`, `accordion`, `collapsible`, `command`, `popover`) into `src/primitives/` and adapt them to our semantic token system.
- Subpath exports via `package.json` `exports` field pointing directly to `.tsx` files: `@1click/ui/cart-drawer`, `@1click/ui/checkout`, `@1click/ui/data/cart`, etc. No `dist/`.
- Peer dependency declarations: React, Next.js, `@medusajs/js-sdk`, `@medusajs/types`, `@medusajs/ui`, Stripe React SDK. Stores provide these; the library does not bundle them. (When the backend is rebuilt to Next.js, `@medusajs/js-sdk` / `@medusajs/types` get replaced with thin internal wrappers that hit the new backend — but that's a future migration, not a Phase 0 concern.)
- `BrandingProvider` skeleton + context type. Reads from a `branding` prop at the provider level; the store wires it to the backend endpoint.
- First test harness — probably just a `playground/` Next.js app inside the repo for visual verification during development. Runs with `bun run playground`.

### Phase 1 — The foundational primitives

These are the smallest, most obviously universal pieces. They unblock everything else.

| Component | Source in mindpages-storefront | Target | Notes |
|---|---|---|---|
| `DualPrice` | `src/modules/cart-drawer/lib/dual-price.tsx` | `packages/i18n/dual-price.tsx` | Also exported as a top-level helper. Delete the duplicate inline copy in `checkout-client/index.tsx` lines 43-74. |
| `Field` (floating-label input) | `src/modules/checkout/templates/checkout-client/index.tsx` lines 143-205 | `packages/primitives/field.tsx` | Extract from the monolith as a standalone file. Keep it unstyled beyond the basic layout. |
| `SelectField` | Same file, lines 207-270 | `packages/primitives/select-field.tsx` | Same as above. |
| `convertToLocale` + `isEmpty` | `src/lib/util/money.ts`, `src/lib/util/isEmpty.ts` | `packages/money/index.ts` | Pure functions, trivial extraction. |
| `medusaError` | `src/lib/util/medusa-error.ts` | `packages/error/medusa-error.ts` | Already v2-format-aware (`081e643`). Move as-is. |
| Constants (`isStripeLike`, `isManual`, `isPaypal`, `noDivisionCurrencies`, `paymentInfoMap`) | `src/lib/constants.tsx` | `packages/payment/constants.ts` | Remove icon imports — the library does not bundle Medusa UI icons. Return plain identifiers, stores render their own icons if needed. |

**Why these first:** they are trivially universal, have zero dependencies on each other (except `DualPrice` → `convertToLocale`), and are blockers for extracting anything bigger. Takes about a day.

### Phase 2 — The data layer

All SDK wrappers move together as one unit. They share cookies, cache-tag helpers, and the Medusa SDK client instance.

| Component | Source | Target |
|---|---|---|
| SDK client config | `src/lib/config.ts` | `packages/data/config.ts` |
| Cookies + auth headers + cache helpers | `src/lib/data/cookies.ts` | `packages/data/cookies.ts` |
| `cart.ts` — full module | `src/lib/data/cart.ts` | `packages/data/cart.ts` |
| `products.ts` | `src/lib/data/products.ts` | `packages/data/products.ts` |
| `orders.ts` | `src/lib/data/orders.ts` | `packages/data/orders.ts` |
| `customer.ts` | `src/lib/data/customer.ts` | `packages/data/customer.ts` |
| `fulfillment.ts` | `src/lib/data/fulfillment.ts` | `packages/data/fulfillment.ts` |
| `payment.ts` | `src/lib/data/payment.ts` | `packages/data/payment.ts` |
| `regions.ts` | `src/lib/data/regions.ts` | `packages/data/regions.ts` |
| `collections.ts`, `categories.ts`, `variants.ts`, `locale-actions.ts`, `locales.ts`, `onboarding.ts` | `src/lib/data/*` | `packages/data/*` |
| `proxy.ts` (region middleware) | `src/proxy.ts` | `packages/middleware/region-proxy.ts` |
| `compare-addresses.ts`, `env.ts`, `get-locale-header.ts` | `src/lib/util/*` | `packages/data/util/*` |

**Extraction notes for the data layer:**
- The `"use server"` directive at the top of each `lib/data/*` file stays. Server actions remain server actions.
- Two `setCartAddresses` / `setAddresses` variants exist in cart.ts — one form-data-based (legacy), one POJO-based (used by single-page checkout). Keep only the POJO version and the form-data version that's still in use by other callers. Audit callers during extraction.
- The legacy `applyGiftCard` / `removeDiscount` / `removeGiftCard` stubs (commented-out bodies) can be deleted during extraction — they're dead code.

**Why together:** the SDK wrappers are so tightly coupled that moving them piecemeal creates import cycles. Move them atomically.

### Phase 3 — Cart drawer (primitives + default assembly)

Every cart drawer component moves. The default assembly (`CartDrawerTemplate`) moves with them but is marked clearly as "optional — stores can compose their own."

| Component | Source | Target |
|---|---|---|
| `CartDrawerProvider` + context | `src/modules/cart-drawer/context.tsx` | `packages/cart-drawer/context.tsx` |
| `CartDrawer` shell | `src/modules/cart-drawer/cart-drawer.tsx` | `packages/cart-drawer/cart-drawer.tsx` |
| `CartDrawerHeader` | `src/modules/cart-drawer/cart-drawer-header.tsx` | `packages/cart-drawer/header.tsx` |
| `CartDrawerWrapper` | `src/modules/cart-drawer/cart-drawer-wrapper.tsx` | `packages/cart-drawer/wrapper.tsx` |
| `CartItem`, `CartItemQuantity`, `CartItemVariant`, `CartItemUpsell` | `src/modules/cart-drawer/cart-item*.tsx` | `packages/cart-drawer/item/*` |
| `CartTieredProgress` | `src/modules/cart-drawer/cart-tiered-progress.tsx` | `packages/cart-drawer/tiered-progress.tsx` |
| `CartPromoBanner` | `src/modules/cart-drawer/cart-promo-banner.tsx` | `packages/cart-drawer/promo-banner.tsx` |
| `CartCrossSellSidebar`, `CartCrossSellCarousel` | `src/modules/cart-drawer/cart-cross-sell-*.tsx` | `packages/cart-drawer/cross-sell/*` |
| `CartGiftWrap` | `src/modules/cart-drawer/cart-gift-wrap.tsx` | `packages/cart-drawer/gift-wrap.tsx` |
| `CartFreeGift` | `src/modules/cart-drawer/cart-free-gift.tsx` | `packages/cart-drawer/free-gift.tsx` |
| `CartNotes` | `src/modules/cart-drawer/cart-notes.tsx` | `packages/cart-drawer/notes.tsx` |
| `CartRewardsPoints` | `src/modules/cart-drawer/cart-rewards-points.tsx` | `packages/cart-drawer/rewards-points.tsx` |
| `CartStickyFooter`, `CartSummaryBreakdown` | `src/modules/cart-drawer/cart-sticky-footer.tsx`, `cart-summary-breakdown.tsx` | `packages/cart-drawer/footer.tsx`, `summary-breakdown.tsx` |
| `CartPaymentBadges` | `src/modules/cart-drawer/cart-payment-badges.tsx` | `packages/cart-drawer/payment-badges.tsx` (receives badge imagery as a prop, no hardcoded paths) |
| `CartContinueShopping`, `CartEmpty` | `src/modules/cart-drawer/cart-continue-shopping.tsx`, `cart-empty.tsx` | `packages/cart-drawer/*` |
| `CartDrawerTemplate` (default assembly) | `src/modules/cart-drawer/index.tsx` | `packages/cart-drawer/template.tsx` — clearly marked optional |

**Issues to fix during extraction:**
- **Hardcoded fallback products** in `cart-drawer/index.tsx` lines 150-154. Remove `FALLBACK_PRODUCTS`. If the cross-sell fetch fails, show nothing — not fake Bulgarian demo items.
- **Bulgarian-specific default config** in `cart-drawer/index.tsx` lines 63-89 (`DEFAULT_CONFIG`). This is store-specific. Do not move it. The library's `CartDrawerTemplate` accepts a required `config` prop; stores provide their own. MindPages puts its current defaults in its own repo.
- **Translations (`t` object)** in `cart-drawer/lib/dual-price.tsx` lines 41-71. Move to a store-provided translation source or a `BrandingContext` field. The library never hardcodes Bulgarian.
- **The `/store/products?limit=8` fetch** in the cross-sell loader should accept a customizable endpoint or product filter via prop. Right now it's a raw fetch inside the assembly.

### Phase 4 — Checkout (the hard one)

The 1684-line `checkout-client/index.tsx` monolith gets decomposed during extraction. This is the highest-value extraction and the most delicate — any mistake ships broken checkout to every store that upgrades.

Decomposition plan:

| Extracted piece | Current location (lines) | Target |
|---|---|---|
| `Field` | 143-205 | Already extracted in Phase 1 |
| `SelectField` | 207-270 | Already extracted in Phase 1 |
| `DualPrice` (duplicate inline copy) | 43-74 | Delete — use the Phase 1 version |
| Translations `t` object | 78-131 | Extract to prop or `BrandingContext`. NOT hardcoded. |
| `CompanyDetails` dropdown | 276-349 | `packages/checkout/company-details.tsx` — takes formData + handlers as props, not a context |
| `CheckoutClient` main component | 353-1181 | Split into: `CheckoutAddressForm`, `CheckoutShippingMethodList`, `CheckoutPaymentMethodList`, `CheckoutStripeCard`, `CheckoutCodOption`, `CheckoutPlaceOrderButton`, and a top-level `CheckoutClient` that composes them |
| `OrderSummary` | 1187-end | `packages/checkout/order-summary.tsx` — independent component |
| `ProductCard` (inside OrderSummary) | inside OrderSummary | `packages/checkout/line-item-card.tsx` |
| `DiscountSection` | inside OrderSummary | `packages/checkout/discount-section.tsx` — may merge with the existing `checkout/components/discount-code` |

**Bugs to fix during decomposition:**
- **The dynamic `require("@lib/data/cart")` at line 446.** Replace with a normal top-level `import { updateCart } from "@1click/ui/data/cart"`. Diagnose why the original author used `require` — likely a circular import from the `"use server"` boundary. If it's a real circular, refactor to break it. If it was speculative, it's trivially fixed.
- **`updateCustomer` call with non-standard fields.** Line 488 passes `company_name`, `metadata.company_vat`, etc. These do not exist on the standard Medusa `StoreUpdateCustomer` type. Today they silently drop. Either (a) add a custom field to the backend via the metafield system and pass through `metadata`, or (b) remove the attempt entirely until the backend supports it. Decision before extraction.
- **Form state shape.** The current form uses `Record<string, string>` with dotted keys like `"shipping_address.first_name"`. During decomposition, decide whether to keep this flat shape or restructure into a nested object. Flat is simpler and matches the existing code; nested is cleaner. Lean toward flat — less churn, less bug surface.

**What stays out of the library:**
- The `MindPages` store name in the checkout layout header. That's the store's job.
- Any specific Bulgarian copy. All strings accept overrides from props or `BrandingContext`.
- The `(checkout)/layout.tsx` — it's thin and store-specific. Each store writes its own.

### Phase 5 — Bulgarian labels + i18n (completed)

All stores today are Bulgarian. Rather than forcing every store to rewrite every string, we ship ready-made Bulgarian label presets alongside the English defaults. One import per provider. See [I18N.md](I18N.md) for multi-language patterns.

### Phase 6 — Product primitives (completed)

Product display was identified as "rhetorical e-commerce infrastructure" — every store needs it, no point waiting for the second store. Extracted from mindpages-storefront, cleaned up during extraction:

- Dropped `lodash.isEqual` → simple `optionsMatch` function
- Dropped tracking calls (Klaviyo/FB/GA4) → `onAddToCart` callback prop (stores wire their own tracking)
- Dropped `@headlessui/react` → plain CSS transitions for MobileActions
- Dropped `@medusajs/ui` components → semantic token classes
- Dropped custom icons → `lucide-react`
- All strings → labels system with Bulgarian preset

### Phase 7 — Catalog/store (completed)

Browsing and filtering: pagination, sort, product grids, and page-level templates for the store, collection, and category pages. Added `listProductsWithSort` back to the data layer (fetches 100 products, sorts client-side by price or date, paginates).

### Phase 8 — Order confirmation (planned)

Post-checkout: the "thank you" page. OrderConfirmationHeader, OrderItem, OrderItemsList, OrderTotals, OrderAddressCard, OrderPaymentCard, OrderCompletedTemplate.

### Phase 9 — Common utilities (planned)

Shared components used across multiple areas: CartButton (header icon with count), DeleteButton, Skeleton loading placeholders, CountrySelect, LanguageSelect.

### Phase 10 — Account (planned, post-launch)

Returning customer features: LoginForm, RegisterForm, AccountNav, AddressBook, OrderHistory, ProfileEditor, AccountLayout. Lower priority — Alenika can launch without accounts.

## What does NOT go in the library

- Store-specific pages (home, about, blog, marketing)
- Store-specific copy / translations
- Store-specific design tokens (colors, fonts)
- Store-specific assets (logos, imagery)
- The `(checkout)/layout.tsx` header with the store name
- Bulgarian defaults or hardcoded strings anywhere
- Fallback / demo data
- Fonts — each store imports its own fonts via `next/font`
- `next.config.js`, `tailwind.config.js`, `tsconfig.json` per store — each store has its own, though the library ships a tailwind preset they can extend

## Extraction order rationale

Why this order:

1. **Alenika's actual needs drive priority.** Alenika wants a full storefront. The minimum it needs to render a real page is: region middleware, data layer, DualPrice, Field. That's Phase 0-2.
2. **Cart drawer is next** because Alenika will ship with at least a cart button → drawer flow. Phase 3.
3. **Checkout is last of the big three** because it is the highest-risk decomposition and benefits most from having Phase 1-3 already shaken out.
4. **Cart page / order / PDP primitives are lowest priority** because Alenika will likely build these visually from scratch and only needs the data-wired primitives when it gets to them.

## Tracking the extraction

Every time a component moves from mindpages-storefront into the library:

1. The library release that includes it goes in this doc's "status" table (below).
2. MindPages-storefront is updated in the same release cycle to consume the library version instead of its local copy. Delete the old local file.
3. Alenika gets access to it for the first time.

| Phase | Status | Library version | Notes |
|---|---|---|---|
| Phase 0 — Foundations | **Complete** | v0.0.1 | Repo skeleton, architecture docs, tsconfig, tailwind-preset, package.json exports |
| Phase 1 — Primitives | **Complete** | v0.1.0 | shadcn/Radix (Button, Input, Select, Dialog, Sheet, Tabs, Accordion, Collapsible, Popover), DualPrice, Field, SelectField, cn, convertToLocale, medusaError, payment constants |
| Phase 2 — Data layer | **Complete** | v0.2.0 | All SDK wrappers (cart, products, orders, customer, fulfillment, payment, regions, collections, categories, variants, locale-actions), region middleware, cookies, sdkFetch wrapper. Fixed Next 16 updateTag migration. |
| Phase 3 — Cart drawer | **Complete** | v0.3.0 | 19 primitives + CartDrawerTemplate. Removed FALLBACK_PRODUCTS, extracted cross-sell loader as prop callback, labels system with English defaults. |
| Phase 4 — Checkout | **Complete** | v0.4.0 | 1684-line monolith decomposed into 17 files. Fixed dynamic require, stripped broken updateCustomer company_name call, replaced lodash isEqual. Labels system with English defaults. |
| Phase 5 — Bulgarian labels + i18n | **Complete** | v0.5.0 | Bulgarian presets for cart drawer + checkout. I18N.md with multi-language patterns. |
| Phase 6 — Product primitives | **Complete** | v0.6.0 | 13 components: Thumbnail, PreviewPrice, ProductPrice, OptionSelect, ImageGallery, ProductActions, MobileActions, ProductTabs, ProductInfo, ProductPreview (card), RelatedProducts, ProductActionsWrapper, ProductTemplate. Bulgarian labels. Dropped lodash, @headlessui, @medusajs/ui, custom icons. |
| Phase 7 — Catalog/store | **Complete** | v0.7.0 | 10 components: Pagination, SortSelect, PaginatedProducts, SkeletonProductGrid, StoreTemplate, CollectionTemplate, CategoryTemplate. Added listProductsWithSort + sortProducts. Bulgarian labels. |
| Phase 8 — Order confirmation | Planned | — | OrderConfirmationHeader, OrderItem, OrderItemsList, OrderTotals, OrderAddressCard, OrderPaymentCard, OrderCompletedTemplate |
| Phase 9 — Common utilities | Planned | — | LocalizedLink (done), CartButton, DeleteButton, Skeleton, CountrySelect, LanguageSelect |
| Phase 10 — Account | Planned | — | LoginForm, RegisterForm, AccountNav, AddressBook, OrderHistory, ProfileEditor, AccountLayout |
