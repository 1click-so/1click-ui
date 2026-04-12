# Architecture

## Why this repo exists

Every 1click store runs on the same backend template (`medusa-mindpages` today, a future Next.js-based backend later) but has its own independent storefront repo. Today those storefronts will diverge in unmanageable ways: a checkout fix made in MindPages has no path to reach Alenika, a Bulgarian law change has to be applied in N places, and every new store starts by copy-pasting from whichever existing store is closest.

This repo ends that. The shared, "write-once" frontend code lives here. Stores install it as a versioned dependency and consume it. Store repos become thin skins over this library — holding only what is genuinely store-specific (branding, copy, layout, marketing pages).

## Stack at a glance

- **Language:** TypeScript
- **Runtime + package manager (library dev):** Bun
- **UI primitives:** shadcn/ui components built on Radix UI (Dialog, Popover, Select, Sheet, Tabs, Accordion, Collapsible, Command, etc.) — accessible, keyboard-navigated, focus-managed out of the box
- **Styling:** Tailwind, library ships a preset with semantic tokens, stores override values to match their brand
- **Packaging:** source-shipped (no bundler). `package.json` exports point directly at `.tsx` files. Consumers use `transpilePackages: ["@1click/ui"]` in their Next.js config. This avoids every transpilation bug bundled libraries typically hit in the React Server Components era.
- **Consumers:** Next.js 16+ apps only. Store repos use Yarn 4 (their choice); this library's choice of Bun is independent.

## The three-layer model

Every piece of frontend code in the 1click ecosystem belongs to exactly one of three layers. Which layer it belongs to determines where it lives, who can edit it, and how it updates.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: UNLOCKED STORE CODE                               │
│  Lives in: <store-repo>/src/                                │
│  Examples: home page, about, collections, nav, footer,     │
│            blog, marketing banners, custom landing pages   │
│  Who edits: us, or (in the future) the 1click AI agent    │
│  Updates: owned by the store, never overwritten            │
└─────────────────────────────────────────────────────────────┘
                          ▲  reads from
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: RUNTIME CONFIG (backend-driven)                   │
│  Lives in: Medusa backend (integration_setting + branding) │
│  Served via: /store/branding, /store/integrations/tracking │
│  Examples: logo, accent color, fonts, store name,          │
│            feature toggles (gift wrap on/off, COD enabled)│
│            copy overrides, promo banner text, tier        │
│            thresholds                                       │
│  Who edits: store admin UI (or the 1click agent via       │
│             admin API)                                      │
│  Updates: instant — locked components re-render            │
└─────────────────────────────────────────────────────────────┘
                          ▲  read at runtime
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: LOCKED LIBRARY CODE (this repo)                   │
│  Lives in: <store-repo>/node_modules/@1click/ui/       │
│  Examples: checkout logic + component files, SDK data     │
│            wrappers, region middleware, Econt selector,   │
│            DualPrice, Field primitive, payment init,      │
│            cart drawer primitives, tracking providers     │
│  Who edits: only us, only in this repo                    │
│  Updates: via version bump in each store's package.json   │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1 — Locked library

Physical location: `node_modules/@1click/ui/` inside each store repo, pulled from this repo's GitHub remote via `yarn install`. Because it lives in `node_modules`, it is outside the store's `src/` — the editable surface. An AI agent (human or otherwise) working in a store repo sees only `src/` and cannot modify locked code. That's the lock mechanism: not a permission flag, just physical absence from the editable workspace.

Locked code holds **structure and logic**. The cart drawer knows how to fetch cross-sell products, how to auto-open when items are added, how to handle Escape to close, how to lock body scroll. The checkout knows how to save addresses on blur, how to initiate payment sessions, how to coordinate optimistic shipping updates. None of this visual — it's machinery.

Updates flow via version pinning. Each store's `package.json` has a line like `"@1click/ui": "github:1click-so/1click-ui#v1.2.3"`. When we fix a component here, we tag a new release. Each store bumps its pinned version and redeploys. Stores that are mid-launch or sensitive can stay on an older pinned version — the update is always explicit, never forced. Stores install with `yarn install` (they run Yarn 4); the library itself is developed with Bun.

### Layer 2 — Runtime config (backend-driven)

Every locked component accepts a `BrandingContext` at the top of the tree. The context reads from a backend endpoint (`/store/branding`, `/store/integrations/tracking`, and similar) and feeds down: logo URL, accent color, fonts, store name, feature toggles, copy overrides, Bulgarian law dates, tier thresholds, anything configurable.

The rule is: **anything the 1click AI agent should be able to change in a client's store must be reachable through runtime config, not through code edits.** When a client says "make the checkout button emerald green" the agent shouldn't be touching checkout code — it should be updating a branding setting via the admin API, and the locked checkout picks up the new color on next render.

What belongs in runtime config vs what belongs in locked code is a design choice that compounds. A config surface that's too thin forces code forks. A config surface that's too rich becomes its own maintenance burden. The rule of thumb: **add a config knob the first time a second store needs the variance, not before.** Premature config is as bad as premature abstraction.

Runtime config is backend-side infrastructure. The backend template (`medusa-mindpages`) already has `integration_setting` and a Phase 2 "Store Branding" roadmap item. That work is where the config endpoints are built. This repo consumes them.

### Layer 3 — Unlocked store code

Everything else. Home page, about, collections, product pages (visual — the data layer is locked), navigation, footer, blog, marketing banners, custom pages. Lives in `<store-repo>/src/`, editable by us or by the 1click agent.

Unlocked store code can import from the locked library freely. A store's home page might use `<DualPrice>` and `<Button>` from `@1click/ui`. A store's nav might use `<CartDrawerTrigger>`. The library provides the primitives, the store composes them however it wants.

The hard rule: **unlocked code never modifies locked code.** If a store needs behavior the library doesn't provide, there are three legal moves (in order of preference):

1. **Compose.** Build the new behavior from library primitives in the store's own `src/`.
2. **Add a config knob or prop to the library.** Benefits every store. Requires a library release.
3. **Eject.** Copy the specific locked file out of `node_modules` into the store's `src/`. The store now owns that file and loses library updates for it. This is the escape hatch, not the default. Ejection should always trigger the question: "could we have added a prop instead, so other stores benefit?"

## Lock boundaries (summary)

Detailed version in [LOCK_BOUNDARIES.md](LOCK_BOUNDARIES.md). Short version:

- **Definitely locked:** checkout (17 components), cart drawer primitives (19 components), product primitives (13 components), catalog primitives (pagination, sort, grids), all SDK data wrappers (`data/*`), region middleware, payment initialization, anything that calls Medusa APIs, anything regulatory (Bulgarian dual-currency math, VAT), labels system + Bulgarian presets.
- **Flexible by default:** CartDrawerTemplate, ProductTemplate, StoreTemplate, CollectionTemplate, CategoryTemplate — optional assemblies that stores can use as-is or replace with their own composition from library primitives.
- **Always unlocked:** home, about, nav, footer, blog, marketing, any store-specific pages. Stores compose these using library primitives for commerce-critical parts.

**The rule:** lock anything where a careless edit can break APIs, payments, or regulatory compliance. Leave visual composition flexible by default. Tighten locks reactively when a real incident proves a boundary was too loose.

## Customization without drift

A store can diverge visually without losing library updates. The mechanisms, from lightest to heaviest:

| Need | Mechanism | Gets library updates? |
|---|---|---|
| Different colors, fonts, copy | Tailwind theme + `BrandingContext` | ✅ Always |
| Different feature set (hide gift wrap, different free-shipping threshold) | Pass config object to library component | ✅ Always |
| Different layout (sticky footer on top, no cross-sell sidebar) | Store composes library primitives its own way | ✅ Primitives still update; only the composition is local |
| Different data/logic on a locked component | Add a prop to the library (benefits all) or eject | ✅ via new prop / ❌ if ejected |

## The 1click AI agent context

The long-term future: clients talk to an AI agent (likely Cursor-based) that has access to their store's GitHub repo. The agent can edit anything in the store's `src/` — unlocked code. It cannot edit locked code because locked code is in `node_modules`, outside the editable surface. For anything locked that the client wants to change (checkout button color, promo banner, free-shipping threshold), the agent uses the backend admin API to update runtime config, not the code.

This means the library's design surface is the agent's operational surface. Every prop, every config knob, every composition slot we expose becomes a thing the agent can safely wire up in response to a client request. Every decision we make about "lock this, expose this as config, leave this open" is a decision about what the agent can and cannot do.

Design the library with the agent in mind from day one.

## Consequences for this repo

- **Headless-first design.** Library components are unstyled or thinly-styled, accept `className` and children slots, and read from context. They are composable, not opinionated about layout.
- **Default assemblies are optional.** For convenience, the library can ship a `CartDrawerTemplate` that assembles the primitives into the mindpages-style 19-component drawer. Stores can use it as-is or bypass it and assemble primitives differently.
- **No store-specific code here, ever.** Not a single Bulgarian string that only mindpages uses. Not a single color from Alenika's palette. If it's specific to one store, it lives in that store's repo.
- **Every API surface is a commitment.** Stores pin to versions. Breaking changes mean coordinating a bump across every store. Add props; avoid renaming them.
- **Documentation is as important as code.** Every exported component needs to tell its story: what it does, what it needs, what it exposes, what it does not do. The 1click agent will eventually read these docs as context for client requests.
