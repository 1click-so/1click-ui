# 1click-ui

The shared **frontend UI component library** for everything 1click builds. Commerce and non-commerce. Every storefront and every future 1click website consumes this library instead of reinventing the same components.

This repo holds the "locked" frontend code that every store inherits: checkout, cart drawer primitives, SDK wrappers, dual-currency math, Econt office selector, Bulgarian VAT logic, tracking providers, floating-label inputs, shadcn/Radix-based primitives, and everything else that should be written once and used everywhere.

Stores install from this repo as a git-pinned dependency. When we fix a component here, stores pick up the fix by bumping their pinned version. Store-specific branding (colors, fonts, copy, layout) never lives here — only the shared machinery.

## Stack

- **Language:** TypeScript
- **Runtime / package manager:** Bun (faster installs, faster scripts, native TypeScript)
- **UI primitives:** shadcn/ui components built on Radix UI (Dialog, Popover, Select, Sheet, Tabs, Accordion, Collapsible, Command, etc.) — accessible, keyboard-navigated, focus-managed
- **Styling:** Tailwind — library ships a Tailwind preset with semantic tokens (`--color-accent`, `--font-display`, etc.); each store overrides the values to match its own brand
- **Packaging:** source-shipped (no bundler). Stores consume `.tsx` files directly via `transpilePackages` in their Next.js config. This is the modern best practice for React component libraries targeting Next.js — zero transpilation bugs, instant iteration, perfect server/client boundary handling.
- **Consumers:** Next.js 16+ apps. Store repos currently on Yarn 4; their choice of package manager is independent of the library's choice of Bun.

## Where things live

| Repo | Local path | Role |
|---|---|---|
| `1click-so/medusa-mindpages` | `C:\Users\User\dev\medusa-mindpages` | **Backend template.** Single shared Medusa v2 codebase that every store's server clones. Alexander works on it using his own MindPages store as patient zero. All fixes fan out to every store via the deploy SOP in `infra/NEW_STORE_SOP.md`. (Backend rebuild to Next.js is planned for the future — TBD timing — at which point the Medusa SDK wrappers in this library will be rewritten to hit the new backend, but the library's public API stays stable so stores are unaffected.) |
| `1click-so/1click-ui` | `C:\Users\User\dev\1click-ui` | **This repo.** Frontend UI component library. Locked code that every store consumes. |
| `1click-so/mindpages-storefront` | `C:\Users\User\dev\mindpages-storefront` | Store repo — MindPages (Alexander's personal store). Consumes `1click-ui`. Holds MindPages-specific branding, home page, marketing pages, custom copy. |
| `1click-so/alenika` | `C:\Users\User\dev\alenika` | Store repo — Alenika (client). Consumes `1click-ui`. Currently a landing page; will grow into a full storefront. |

## Naming note

The library is `1click-ui` — intentionally generic. It holds commerce components today (checkout, cart drawer, Medusa SDK wrappers) but will grow to hold non-commerce UI primitives used on landing pages, marketing sites, and other 1click projects. No artificial split between "commerce" and "ui" — one unified library.

The future 1click AI agent (Cursor-based) will eventually edit unlocked parts of client sites on behalf of clients. This library is what the agent operates AGAINST — the locked machinery it cannot touch, with a well-defined config surface (`BrandingContext` + backend settings) that IS the agent's operational space.

## Read the docs before coding

Anything you touch in this repo has downstream impact on every store. Read these first:

1. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — three-layer model: locked library / runtime config / unlocked store src. The mental model for why everything is organized the way it is.
2. [docs/LOCK_BOUNDARIES.md](docs/LOCK_BOUNDARIES.md) — what's locked, what's flexible, and why. The rules that decide whether a new piece of code belongs in this repo or in a store repo.
3. [docs/UPDATE_FLOW.md](docs/UPDATE_FLOW.md) — how fixes propagate from here into every store. Git-install workflow, release tags, rollback, dev loop.
4. [docs/LIBRARY_SCOPE.md](docs/LIBRARY_SCOPE.md) — initial extraction plan: what's moving from `mindpages-storefront` into this library, in what order, and why.
5. [KNOWN_ISSUES.md](KNOWN_ISSUES.md) — tracked known issues, deferred fixes, and things we're aware of but not addressing yet.

## Status

**v0.7.0** — the library covers the complete shopping flow from product browsing through checkout to order placement. Current inventory:

| Area | Version | Components |
|---|---|---|
| Repo skeleton + architecture docs | v0.0.1 | Phase 0 |
| shadcn/Radix primitives (Button, Input, Select, Dialog, Sheet, Tabs, Accordion, Collapsible, Popover) + DualPrice + Field | v0.1.0 | 12 primitives |
| Data layer (all Medusa API calls) + region middleware | v0.2.0 | 14 data modules + middleware |
| Cart drawer (19 primitives + CartDrawerTemplate) | v0.3.0 | 19 components |
| Checkout (decomposed from 1684-line monolith into 17 files) | v0.4.0 | 17 components |
| Bulgarian label presets + i18n doc | v0.5.0 | Labels for cart drawer + checkout |
| Product primitives (Thumbnail, ProductCard, PDP, gallery, variant picker, add-to-cart) | v0.6.0 | 13 components |
| Catalog (pagination, sort, product grids, store/collection/category templates) | v0.7.0 | 10 components |

**Total: ~100 source files, all type-checked, zero errors.**

Labels ship in English (defaults) + Bulgarian for every area. Multi-language stores map the active locale to the matching labels object — see [docs/I18N.md](docs/I18N.md).

A `playground/` subfolder contains a minimal Next.js 16 app that imports the library and builds clean — verifying transpilePackages, Tailwind token resolution, and RSC boundaries.

### Remaining phases (not blocking Alenika launch)

- **Phase 8:** Order confirmation primitives
- **Phase 9:** Common utilities (LocalizedLink, CartButton, skeletons)
- **Phase 10:** Account module (login, register, order history, address book)
