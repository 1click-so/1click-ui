# Update Flow

How fixes and new features propagate from this library into every store that consumes it.

## Packaging model

This library is consumed as a **git-pinned dependency**. Each store's `package.json` has a line like:

```json
"dependencies": {
  "@1click/ui": "github:1click-so/1click-ui#v1.2.3"
}
```

When a store runs its installer (`yarn install` — store repos currently use Yarn 4), the installer pulls the library directly from GitHub at the pinned tag. No npm registry, no publish step, no GitHub Packages auth to configure. The library repo is private, so the store's build environment (Vercel) needs permission to read it — handled via a GitHub deploy key added to each store's Vercel project. One-time setup per store, done at store creation.

Because the library is **source-shipped** (no bundler, raw `.tsx` files), the store's Next.js config needs one addition:

```js
// next.config.js in each store
module.exports = {
  transpilePackages: ["@1click/ui"],
  // ...
}
```

This tells Next.js to compile the library's TypeScript source alongside the store's own code. It's the modern best practice for React component libraries targeting Next.js consumers — zero transpilation bugs, perfect React Server Component / `"use client"` handling, tree-shaking, and Tailwind content scanning all handled by the consumer's existing build pipeline.

Tailwind content paths in each store's `tailwind.config.js` also need to include the library:

```js
content: [
  "./src/**/*.{js,ts,jsx,tsx}",
  "./node_modules/@1click/ui/**/*.{js,ts,jsx,tsx}",
]
```

### Why git install instead of npm publish

- **Zero publish friction.** Fix → tag → done. No `npm publish`, no registry credentials, no version-bump ceremony beyond `git tag`.
- **Versioned anyway.** Git tags are versions. Each store pins to one.
- **No private registry to maintain.** Saves us from running GitHub Packages, Verdaccio, or paying for an npm registry.
- **Works identically in dev and CI.** All installers (Bun, Yarn, npm) handle git URLs natively.

### Why source-shipped instead of bundled

- **No transpilation bugs.** Every bundler (tsup, vite-lib, rollup) has edge cases with `"use client"` directives, React Server Components, and cross-module tree-shaking in 2026. Shipping source side-steps all of them.
- **Instant iteration.** No build step in the library means every save is immediately visible in a consuming store running `next dev`. Fastest possible dev loop.
- **Tailwind just works.** Because Tailwind scans `.tsx` files in `node_modules/@1click/ui/`, no preprocessing is needed to extract classes — they're right there in the source.
- **Correct server/client boundaries.** Next.js reads `"use client"` directives from source files natively. No bundler plugin is needed to preserve them.
- **Smaller library repo.** No `dist/` folder in git, no pre-built artifacts, no CI publish step.
- **Reversible.** If we ever need to support non-Next.js consumers, we add a `tsup` build as a second output. Cheap to add later, expensive to have now.

### Why versioned instead of floating

Every store pins to an explicit version (tag or commit). Never `main`. Never a branch. Two reasons:

1. **Blast radius control.** A bug in a new version of the library can't silently ship to every store on the next install. Upgrades are explicit.
2. **Per-store release freedom.** A store in the middle of a launch or a critical period can stay on an older version while other stores upgrade. Useful during incident response.

## Versioning scheme

Semantic versioning, pragmatic:

- **Major (v1 → v2).** Breaking change — a prop was renamed, a component was removed, a default behavior changed in a way that requires each store to update its own code to absorb. Coordinate across stores before releasing.
- **Minor (v1.2 → v1.3).** New feature — new component, new prop, new config knob. Backward compatible. Stores can upgrade when convenient.
- **Patch (v1.2.3 → v1.2.4).** Bug fix, no API change. Stores should upgrade soon, especially for anything touching payment, region, or data integrity.

Tags are `vX.Y.Z`. No `v-alpha`, no `v-beta` — if it's tagged, it's production-ready.

## The fix workflow

### 1. Fix in this repo

Edit the component locally. Run the library's own checks. Commit.

```bash
cd C:/Users/User/dev/1click-ui
# edit files
bun run typecheck    # tsc --noEmit, just type checking
bun run test         # once we have tests
git add -A
git commit -m "Fix: DualPrice rounding for sub-cent BGN conversion"
git push
```

The library itself uses **Bun** as its runtime and package manager — faster installs, native TypeScript, no build step needed locally. Stores do not need Bun; they use whatever installer they already have (Yarn 4 today for mindpages-storefront and alenika).

### 2. Tag a release

```bash
git tag v1.2.4
git push --tags
```

That's it. The release is live. Stores can now pin to it.

### 3. Propagate to stores — sequentially, following the deploy SOP

This mirrors the backend deploy SOP (`medusa-mindpages/infra/NEW_STORE_SOP.md`). Never parallel. One store at a time, fully verified, before moving to the next.

For each store, in order:

```bash
# 1. Go to store repo
cd C:/Users/User/dev/mindpages-storefront    # or alenika, or client-X

# 2. Bump the pinned version in package.json
#    "@1click/ui": "github:1click-so/1click-ui#v1.2.3"  ← old
#    "@1click/ui": "github:1click-so/1click-ui#v1.2.4"  ← new

# 3. Refresh the store's lockfile (Yarn 4 today)
yarn install

# 4. Verify locally
yarn dev
# → test the area that changed
# → test checkout end-to-end if the library change touched checkout or data layer
# → visual smoke test of affected pages

# 5. Commit + push
git add package.json yarn.lock
git commit -m "Upgrade @1click/ui to v1.2.4 — DualPrice rounding fix"
git push

# 6. Vercel auto-deploys on push. Monitor the deploy.

# 7. Post-deploy verification:
#    → health check
#    → walk through checkout on the production storefront
#    → spot-check any page the change touched
#    → check Sentry / logs for new errors

# 8. Only after ALL checks pass, move to the next store
```

### 4. Update each store's state doc

Once a store is on a new library version, record it in `medusa-mindpages/infra/stores/<slug>.md` under a "Library Version" section so the running state of every store is visible from one place. Commit and push.

## Rollback

If a library upgrade breaks a store in production:

**Fastest:** revert the store's `package.json` + `yarn.lock` commit, push, let Vercel redeploy to the previous version. Takes 2-3 minutes.

```bash
cd C:/Users/User/dev/<store>
git revert <upgrade-commit>
git push
```

**If the library itself is broken for everyone:** fix the bug in the library, tag a new patch version, roll every store forward to the new patch. Do NOT retag an existing version — tags should be immutable.

```bash
cd C:/Users/User/dev/1click-ui
# fix
git commit
git tag v1.2.5   # new tag, not v1.2.4 again
git push --tags
```

## When NOT to upgrade a store immediately

- The store is mid-launch. Defer until after launch.
- The store is handling a high-traffic event (sale, campaign). Defer until traffic normalizes.
- The change is a new feature the store doesn't need. Defer; upgrade in the next maintenance window.
- Critical fixes (payment, region, data integrity) override all of the above. Those go out immediately.

## Dev loop — working on the library and a store at the same time

Sometimes you need to change the library AND see the change in a store without tagging a release for every iteration. Two ways:

### Option A: File-path install (simplest)

In the store's `package.json`:

```json
"@1click/ui": "file:../1click-ui"
```

Run `yarn install` in the store. Now the store uses the local library source directly. Save a file in `1click-ui/`, Next.js hot-reloads the store instantly. When done, restore the git-tagged version and run `yarn install` again.

**Rule:** never commit a `file:` reference — it will break Vercel builds. Always restore the git URL before committing.

### Option B: Package-manager link

```bash
# Yarn 4 (mindpages-storefront, alenika)
cd C:/Users/User/dev/mindpages-storefront
yarn link ../1click-ui
```

Same effect as file-path, slightly more automatic. Yarn tracks the link; `yarn unlink` reverses it.

## Coordinating breaking changes

A major version (v1 → v2) implies breaking changes. Process:

1. Write the new version in a branch of this repo. Do not tag yet.
2. In each store repo, create a local branch, install from the library branch (`github:1click-so/1click-ui#breaking-v2`), absorb the changes.
3. When all stores have a passing build against the new version, tag `v2.0.0` in the library.
4. Merge each store's branch to main, redeploy.

This is the only way to avoid a store being stranded on an old version because the upgrade path was never tested.

## Long-term: replacing git-install with GitHub Packages or npm

Git-install is the right choice now. If the library grows large, gets external consumers, or needs semver automation, we can move to:

- **GitHub Packages** — private npm registry hosted by GitHub. Install with `@1click/ui` as a normal npm scope. Adds an auth step in each store's `.npmrc`.
- **Public npm** — only if/when we want to open-source parts of the library.

No rush. The upgrade path from git-install to packages is straightforward (add a publish step to CI, add an `.npmrc` to each store) and reversible. Defer the decision until git-install actually causes pain.
