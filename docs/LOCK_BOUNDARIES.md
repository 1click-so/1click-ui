# Lock Boundaries

This document answers a single question for every piece of frontend code: **does it belong in this repo (locked library), or in a store repo (unlocked)?**

The answer governs who can edit it, how it updates, and how far the blast radius of a mistake can reach.

## The decision rule

> **Lock anything where a careless edit can break APIs, payment flows, cart/order state, or regulatory compliance. Leave visual composition flexible by default. Tighten locks reactively when an incident proves a boundary was too loose.**

Two tests decide lock vs flexible:

1. **Blast radius.** If this code breaks, what breaks? If the answer is "orders stop flowing" or "payments fail" or "customers see the wrong price," it is locked. If the answer is "the home page hero looks ugly," it is flexible.
2. **Universality.** If every store needs the same logic here, it is a candidate for locking. If each store will want its own version, it stays flexible.

Both tests must point toward "lock" before code lives in this repo.

## Current boundaries

### LOCKED — always

These are non-negotiable. They live in this repo, stores consume them as-is, customization happens only through props / config / context.

| Area | What | Why |
|---|---|---|
| **Checkout** | All component files, state machine, form logic, address auto-save, shipping method selection, payment init, Stripe element wiring, order placement | Breaking checkout breaks revenue. Regulatory logic (Bulgarian dual currency, VAT) lives here. Payment correctness is non-optional. This is the MOST important thing to lock. |
| **Data layer (`lib/data/*`)** | All SDK wrappers: `cart.ts`, `products.ts`, `orders.ts`, `customer.ts`, `fulfillment.ts`, `payment.ts`, `regions.ts`, `collections.ts`, `categories.ts`, `variants.ts`, `cookies.ts`, `locale-actions.ts`, `onboarding.ts` | These are the only path to the Medusa backend. A careless edit here silently breaks every store. Uniform behavior required. |
| **Region middleware (`proxy.ts`)** | Country-code detection, region map caching, redirect logic | Wrong region → wrong currency → wrong tax → wrong shipping. Mistakes here are silent and catastrophic. |
| **Payment initialization** | `initiatePaymentSession`, `PaymentWrapper`, Stripe context provider | Payment providers have specific contract requirements. Wrong wiring = failed transactions. |
| **Tracking providers** | `TrackingProvider`, GTM / FB Pixel / GA4 / Klaviyo client-side script injection, dedup event IDs | Incorrect tracking = broken attribution, broken ad spend, broken analytics. Must be consistent across stores. |
| **Regulatory math** | `DualPrice` component + `EUR_TO_BGN` rate, VAT-inclusive display logic, Bulgarian law effective dates | This is literally legally required. One source of truth. |
| **Econt office selector** | Logic for fetching nearest offices, OpenStreetMap geocoding, office selection state, cart metadata persistence | Complex integration, brittle external API, not something stores should reimplement. |
| **Floating-label `Field` primitive** | The input component used throughout checkout | Changes propagate across every form everywhere. One canonical version. |
| **Order placement flow** | `placeOrder`, `complete` SDK call, post-order redirect, cart cleanup | Correctness determines whether an order is actually recorded. |

### FLEXIBLE — library provides primitives, store composes

These live in the library as **primitives** (small, focused, composable components). The library also ships a **default assembly** (a full composed version that matches today's mindpages implementation) as a convenience. But stores are encouraged to compose their own assembly from the primitives if they want something different.

The primitives still update via version bump. The store's custom assembly is the store's code and updates only when the store changes it.

| Area | Primitives (locked) | Default assembly (optional) |
|---|---|---|
| **Cart drawer** | `CartDrawer` shell (slide-out, overlay, esc/click-out), `CartItem`, `CartItemQuantity`, `CartItemVariant`, `CartStickyFooter`, `CartTieredProgress`, `CartPromoBanner`, `CartCrossSellSidebar`, `CartCrossSellCarousel`, `CartGiftWrap`, `CartNotes`, `CartRewardsPoints`, `CartFreeGift`, `CartPaymentBadges`, `CartContinueShopping`, `CartEmpty`, `CartSummaryBreakdown`, `CartDrawerHeader` | `CartDrawerTemplate` — composes all 19 into the current mindpages layout. Stores use as-is OR bypass and write their own assembly. |
| **Cart page** | `CartItemsList` (reuses `CartItem`), `CartSummary`, `EmptyCart`, `SignInPrompt`, `DiscountCode` | `CartPageTemplate` — 2-column layout with sticky summary. Stores can replace. |
| **Order confirmation** | `OrderConfirmationHeader`, `OrderTimeline`, `OrderItemsList` (reuses the `OrderItem` primitive), `OrderTotals`, `OrderAddressCard`, `OrderDeliveryCard`, `OrderPaymentCard`, `OrderHelpSection`, `OrderPostPurchase` | `OrderCompletedTemplate` — current mindpages 2-column thank-you layout. |
| **Product detail** | `ImageGallery`, `ProductTabs`, `ProductPrice`, `ProductActions`, `RelatedProducts`, `Thumbnail` | `ProductTemplate` — starter-style layout. Stores will almost certainly replace this. |

**Why cart drawer is flexible.** We built 19 cart drawer components, but no single store will use all of them. MindPages wants tiered progress and cross-sell; Alenika might want neither and prefer a sticky-top layout; a future client might want just items and checkout button. Locking the assembly forces either feature bloat or rigid per-store forks. Primitives + flexible composition gives every store what it needs with zero drift from shared bug fixes.

**Why cart page and order confirmation are flexible.** Same reason. The data is uniform (orders have items, totals, shipping, payment) but the visual treatment is wide open. Lock the data wiring, expose the pieces.

**Why product detail is flexible.** Every store redesigns its PDP. This is the most store-expressive page and the least universal. The library provides data-wired primitives (price, image gallery, variant selector) but no store should be forced into a single PDP layout.

### ALWAYS UNLOCKED — lives in store repos

These never live in this library. They are store-specific by definition.

- Home page / landing pages
- About, contact, FAQ
- Collection pages (visual — data comes from library hooks)
- Navigation (header, mobile menu, mega-menu)
- Footer
- Blog (index + post pages)
- Marketing banners, promo sections
- Any custom landing pages
- Store-specific translations and copy overrides
- Store-specific design tokens (Tailwind theme, fonts, colors)
- Logos, imagery, brand assets

A store repo's job is to **compose** these unlocked pages using library primitives for the commerce-critical parts (add to cart, dual price, region detection, tracking injection) and its own code for everything else.

## Can a locked component be skinned?

Yes, three ways, none of which involve editing library code:

1. **Tailwind theme via preset.** The library ships a `tailwind-preset.js` with semantic token names (`--color-accent`, `--color-surface`, `--font-display`). Stores override these values in their own `tailwind.config.js`. The library component uses `bg-accent`, the store's value of `--color-accent` decides what that renders as.
2. **`BrandingContext`.** For values that can't live in CSS (logo URLs, copy strings, feature toggles, Bulgarian law effective dates, free-shipping thresholds), the library exposes a `BrandingProvider` at the store's layout root. Children read from the context. The provider gets its values from the Medusa backend at runtime.
3. **`className` pass-through and slot props.** Every library component accepts a `className` prop and `children` / slot props for extension. A store can wrap, extend, or inject without modifying the library.

If none of these three work for a specific need, that need is either (a) generic enough to become a new prop/config knob in the library or (b) so store-specific it belongs in unlocked store code.

## Ejection (the escape hatch)

When a store genuinely needs different logic in a locked component — not different styling, not different config, different **behavior** — ejection is the last resort.

To eject:
1. Copy the locked file from `node_modules/@1click/ui/...` into the store's `src/` (no `dist/` — the library is source-shipped, so the `.tsx` file you copy is the actual source)
2. Update the store's imports to point to the local copy
3. Commit. The store now owns that file.
4. **Add a comment at the top of the ejected file** recording the library version it was copied from and the reason for ejection

Consequences:
- That specific file no longer gets library updates for this store.
- Every other library file still updates normally.
- If the library ever gains a prop that would have solved the original need, the store can remove its ejected copy and go back to using the library version.

Ejection should be **rare and visible**. Every ejection is a signal that the library's design surface was too narrow for some legitimate use case. A running count of ejected files across all stores tells us where the library needs more props or better primitives.

## When to lock something that is currently flexible

Tightening a lock is a retroactive move. You lock a boundary that was flexible because flexibility caused a real incident.

Criteria for tightening:
- A careless edit in a store repo broke something that should not have been editable.
- Two or more stores implemented the same workaround because a primitive didn't expose something.
- A security or compliance concern emerged.

Process:
1. Raise it explicitly in a decision doc (add a section to this file or a new decision log).
2. Move the code into the library as a new locked component.
3. Coordinate the migration: every store currently with a local version has to switch to the library version in its next release.
4. Document the reason for the lock in this file so future decisions know why.

## When to loosen a lock

Reverse process. Rare. Most justified when:
- Every store is ejecting the same file for the same reason → the library's version was wrong for everyone.
- A component turns out to not be commerce-critical → its blast radius was overestimated.

If a component is loosened, migrate it out of the library, have each store copy its last library version into its own repo, and delete from the library.

## Running list of locked / flexible decisions

Keep this table updated as the library grows. Every new component lands with a lock decision.

| Component | Status | Decided | Reason |
|---|---|---|---|
| Checkout | LOCKED | 2026-04-11 | Revenue-critical, regulatory, non-negotiable |
| `lib/data/*` SDK wrappers | LOCKED | 2026-04-11 | Silent failure risk, uniformity required |
| `proxy.ts` region middleware | LOCKED | 2026-04-11 | Region correctness catastrophic if wrong |
| Payment providers / wrappers | LOCKED | 2026-04-11 | Payment contract integrity |
| Tracking providers | LOCKED | 2026-04-11 | Attribution / analytics consistency |
| `DualPrice` + `EUR_TO_BGN` | LOCKED | 2026-04-11 | Regulatory compliance, one source of truth |
| Econt office selector | LOCKED | 2026-04-11 | Complex integration, stores shouldn't reimplement |
| `Field` (floating-label input) | LOCKED | 2026-04-11 | Used in every form, consistency required |
| Cart drawer — primitives | LOCKED | 2026-04-11 | Logic is universal |
| Cart drawer — assembly | FLEXIBLE | 2026-04-11 | Stores compose their own layout from primitives |
| Cart page — primitives | LOCKED | 2026-04-11 | Logic is universal |
| Cart page — layout | FLEXIBLE | 2026-04-11 | Stores compose |
| Order confirmation — primitives | LOCKED | 2026-04-11 | Logic is universal |
| Order confirmation — layout | FLEXIBLE | 2026-04-11 | Stores compose |
| Product detail — primitives | LOCKED | 2026-04-11 | Logic is universal |
| Product detail — layout | FLEXIBLE | 2026-04-11 | Every store redesigns PDP |
