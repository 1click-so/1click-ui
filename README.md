<p align="center">
  <h1 align="center">1click-ui</h1>
  <p align="center">
    <strong>The e-commerce component library that ships entire storefronts.</strong>
    <br />
    Built on shadcn/ui + Radix + Tailwind + Medusa v2.
    <br />
    Source-shipped. Theme-able. Multi-language.
    <br /><br />
    <a href="https://1click.bg">Website</a> &middot; <a href="docs/ARCHITECTURE.md">Architecture</a> &middot; <a href="docs/I18N.md">i18n Guide</a> &middot; <a href="KNOWN_ISSUES.md">Known Issues</a>
  </p>
</p>

---

## What is this?

One `npm install` gives your Next.js storefront a **complete shopping experience** — product browsing, product detail pages, cart drawer, checkout, order confirmation — all wired to a Medusa v2 backend, all customizable through CSS variables and label overrides.

Change 10 CSS variables and the entire library repaints to your brand. No code changes. No forking.

---

## What's inside

| Area | Count | Highlights |
|------|-------|-----------|
| **UI Primitives** | 12 | Button, Input, Select, Dialog, Sheet, Tabs, Accordion — shadcn/ui + Radix |
| **Product Display** | 13 | ProductCard, ProductPrice, ImageGallery, VariantSelector, ProductActions, RelatedProducts |
| **Catalog** | 10 | ProductGrid, Pagination, SortSelect, Store/Collection/Category templates |
| **Cart Drawer** | 19 | Slide-out cart with tiered progress, cross-sell, gift wrap, promo banners |
| **Checkout** | 17 | Single-page checkout — address, shipping, Stripe, COD, Econt office selector |
| **Order Confirmation** | 10 | Thank-you page with timeline, delivery details, payment info |
| **Data Layer** | 14 | All Medusa v2 API calls — server actions with caching and revalidation |
| **Common Utilities** | 7 | CartButton, DeleteButton, CountrySelect, LanguageSelect, Skeletons |
| **i18n** | 5 areas | English defaults + Bulgarian presets. Type-safe — missing translations fail typecheck. |

**~120 source files. Zero build step. Zero bundler.**

---

## Quick Start

### Install

```bash
npm install github:1click-so/1click-ui#v0.9.0
```

Plus peer dependencies:

```bash
npm install @medusajs/js-sdk @medusajs/types \
  @radix-ui/react-accordion @radix-ui/react-collapsible @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-popover \
  @radix-ui/react-select @radix-ui/react-slot @radix-ui/react-tabs \
  @stripe/react-stripe-js @stripe/stripe-js \
  class-variance-authority clsx lucide-react server-only tailwind-merge
```

### Configure Next.js

```js
// next.config.js
module.exports = {
  transpilePackages: ["@1click/ui"],
}
```

### Configure Tailwind

```js
// tailwind.config.js
const uiPreset = require("@1click/ui/tailwind-preset")

module.exports = {
  presets: [uiPreset],
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@1click/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
}
```

### Set your brand

```css
/* globals.css */
:root {
  --color-accent: 24 95% 53%;        /* your brand color (HSL) */
  --color-accent-fg: 0 0% 100%;      /* text on accent */
  --color-surface: 0 0% 100%;        /* card backgrounds */
  --color-surface-muted: 240 5% 96%; /* muted backgrounds */
  --color-border: 240 6% 90%;
  --color-text-base: 240 10% 4%;
  --color-text-muted: 240 4% 46%;
  --color-text-subtle: 240 5% 65%;
  --color-success: 142 71% 45%;
  --color-warning: 38 92% 50%;
  --color-danger: 0 84% 60%;
  --radius: 0.5rem;
}
```

### Environment variables

```bash
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://your-medusa-backend.com
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_your_key_here
```

---

## Usage

```tsx
// Product listing
import { listProducts } from "@1click/ui/data/products"
import { ProductPreview } from "@1click/ui/products"

// Cart drawer with Bulgarian labels
import { CartDrawerProvider, bulgarianCartDrawerLabels } from "@1click/ui/cart-drawer"

// Full checkout
import { CheckoutProvider, bulgarianCheckoutLabels } from "@1click/ui/checkout"
import { CheckoutClient } from "@1click/ui/checkout/checkout-client"

// Order confirmation
import { OrderCompletedTemplate, bulgarianOrderLabels } from "@1click/ui/order"
```

Every component is a subpath import. Tree-shaking is automatic — you only ship what you use.

---

## Theming

The library uses **semantic CSS variables** for all visual values. Components use utility classes like `bg-accent`, `text-text-base`, `border-border` — mapped to your CSS variables through the Tailwind preset.

**10 variables = complete rebrand.** No forking. No code changes. Every store looks different, same library.

---

## Multi-language

Every user-facing string is a translatable label. The library ships with:

- **English** — defaults, always complete
- **Bulgarian** — full translation for all areas

```tsx
// One line to switch a store to Bulgarian
<CartDrawerProvider cart={cart} labels={bulgarianCartDrawerLabels}>
<CheckoutProvider labels={bulgarianCheckoutLabels}>
```

Adding a new language: create a typed labels file, export it. TypeScript enforces every field is present — missing translations fail typecheck. See [i18n Guide](docs/I18N.md).

---

## Architecture

Three-layer model — every piece of code belongs to exactly one layer:

```
  UNLOCKED STORE CODE        ← pages, layout, marketing (store's src/)
         ▲
  RUNTIME CONFIG              ← CSS variables, labels, backend settings
         ▲
  LOCKED LIBRARY (this repo)  ← logic, data, components (node_modules/)
```

Stores compose library primitives into their own pages. Optional template assemblies (`CartDrawerTemplate`, `ProductTemplate`, `StoreTemplate`) provide ready-made layouts — use as-is or replace entirely.

Read more: [Architecture](docs/ARCHITECTURE.md) &middot; [Lock Boundaries](docs/LOCK_BOUNDARIES.md) &middot; [Update Flow](docs/UPDATE_FLOW.md)

---

## Why source-shipped?

This library ships **raw `.tsx` files** — no bundler, no `dist/`. Your Next.js app compiles them via `transpilePackages`.

- Zero transpilation bugs (no bundler edge cases with `"use client"` or RSC)
- Instant hot-reload during development
- Tailwind scans library classes automatically
- Perfect server/client boundary handling
- No build step in the library repo

---

## Stack

| | |
|---|---|
| **Language** | TypeScript — strict mode, `noUncheckedIndexedAccess` |
| **Framework** | React 19 + Next.js 16 (App Router, Server Components, Server Actions) |
| **Primitives** | shadcn/ui + Radix UI |
| **Styling** | Tailwind CSS with semantic token preset |
| **Backend** | Medusa v2 via `@medusajs/js-sdk` |
| **Payments** | Stripe via `@stripe/react-stripe-js` |
| **Icons** | lucide-react |
| **Dev runtime** | Bun (stores use any package manager) |

---

## Documentation

| Doc | What it covers |
|-----|---------------|
| [Architecture](docs/ARCHITECTURE.md) | Three-layer model, lock boundaries, customization |
| [Lock Boundaries](docs/LOCK_BOUNDARIES.md) | What's locked vs flexible and why |
| [Update Flow](docs/UPDATE_FLOW.md) | Versioning, deployment, rollback |
| [Library Scope](docs/LIBRARY_SCOPE.md) | Extraction phases and status |
| [i18n](docs/I18N.md) | Multi-language patterns |
| [Known Issues](KNOWN_ISSUES.md) | Tracked issues and deferred fixes |

---

<p align="center">
  Built by <a href="https://1click.bg"><strong>1click</strong></a> — e-commerce infrastructure for online stores.
</p>
