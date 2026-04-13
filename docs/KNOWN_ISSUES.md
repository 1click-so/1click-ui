# Known Issues

Documented bugs, gotchas, and their resolutions for the 1click Medusa platform. Read this before burning hours on something already solved.

---

## Storefront: Turbopack + Tailwind v4 fork bomb (OOM crash)

**Status:** Resolved via version pin. Do not upgrade `tailwindcss` above `4.0.7` in storefront projects until fixed upstream.

**Discovered:** 2026-04-12 (Alenika storefront during shadcn preset application).

### Symptoms

- Running `next dev` on a storefront that uses `@1click/ui` + Tailwind v4 spawns 1,500–2,500 Node processes within seconds.
- RAM usage climbs past 40 GB on a 64 GB machine, OS locks up, OOM crash.
- Dev server never finishes first compile; if it does, every file change re-triggers the explosion.
- Error variants: `EADDRINUSE`, `JavaScript heap out of memory`, whole-system freeze.

### Root cause

Turbopack runs each PostCSS loader in its own worker process. Tailwind v4's class-detection engine has no shared-cache API, so every worker independently re-scans every path declared in `@source` — including `node_modules/@1click/ui` — and spawns more workers in the process. Output of one worker becomes input for the next. Feedback loop.

The bug is amplified on storefronts because they point `@source` into `node_modules/@1click/ui` to pick up library class names (required for source-shipped libraries). Simple projects without `@source` don't trigger it.

This is a known architectural limitation of Turbopack + Tailwind v4.1.x+. Confirmed across multiple GitHub issues:

- [vercel/next.js#78407 — Turbopack + Tailwind hangs on large codebases](https://github.com/vercel/next.js/issues/78407)
- [vercel/next.js#77102 — Turbopack dev server stuck, extreme CPU/memory](https://github.com/vercel/next.js/discussions/77102)
- [vercel/next.js#81161 — Turbopack dev server uses too much RAM](https://github.com/vercel/next.js/issues/81161)
- [vercel/next.js#88443 — Tailwind CSS v4.1.18 + Next.js 16 build failure](https://github.com/vercel/next.js/discussions/88443)

### Fix

Pin both Tailwind packages to `4.0.7`. Newer 4.1.x and 4.2.x versions are broken with Turbopack:

```bash
yarn add -D tailwindcss@4.0.7 @tailwindcss/postcss@4.0.7
```

Keep `@source` in `globals.css` — the directive is correct and required for scanning library classes. The bug is in Tailwind's handling of it, not in the directive itself.

### Related fixes applied in the same session

While diagnosing the fork bomb, a second set of issues surfaced. For reference:

1. **Next.js couldn't find the `next` package.** Yarn 4 defaults to PnP mode, which keeps packages in a zip cache instead of `node_modules`. Turbopack can't see them. Fix: add `.yarnrc.yml` with `nodeLinker: node-modules`, then `yarn install`.

2. **Turbopack "Unknown module type" for `.ts` files from `node_modules/@1click/ui`.** Source-shipped libraries need Next.js to transpile them. Fix: add `transpilePackages: ["@1click/ui"]` to `next.config.js`.

3. **Workspace root inference warning.** Fix: add `turbopack.root: path.join(__dirname)` to `next.config.js`.

4. **No CSS output despite correct setup.** `@theme inline` doesn't exist in Tailwind 4.0.7 (it was introduced in a later minor version). Fix: use plain `@theme { ... }` in `globals.css`.

### Final working configuration

**`package.json`** (devDependencies):
```json
"tailwindcss": "4.0.7",
"@tailwindcss/postcss": "4.0.7"
```

**`.yarnrc.yml`**:
```yaml
nodeLinker: node-modules
```

**`next.config.js`**:
```js
const path = require("path")

const nextConfig = {
  transpilePackages: ["@1click/ui"],
  turbopack: {
    root: path.join(__dirname),
  },
  images: { /* ... */ },
}

module.exports = nextConfig
```

**`postcss.config.mjs`**:
```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
```

**`src/app/globals.css`** (first lines):
```css
@import "tailwindcss";
@source "../../node_modules/@1click/ui";

@theme {
  /* token mappings */
}
```

### Operational rule

Before starting any `next dev` session: `taskkill //f //im node.exe` first. Orphaned Turbopack workers from previous runs compound the RAM cost and can crash the machine even with the version pin in place. See `.claude/projects/.../memory/feedback_kill_before_restart_dev_server.md`.

### Revisit

When Vercel/Tailwind fix the feedback loop upstream, reassess the pin. Track the linked issues. Do not upgrade without verifying on a throwaway project first.