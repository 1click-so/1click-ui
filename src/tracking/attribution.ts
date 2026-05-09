"use client"

/**
 * Self-managed Facebook attribution helpers.
 *
 * Why this exists: Meta Pixel sets _fbp / _fbc cookies on init, which
 * happens via `<Script strategy="afterInteractive">`. Our React
 * useEffect tracking calls run during hydration — frequently BEFORE
 * the Pixel script has finished downloading. The result is that
 * `fireCapiEvent` reads document.cookie, finds nothing, and ships an
 * empty fbp/fbc to Meta CAPI. Event Match Quality tanks, and the
 * "Other dedup keys: 0%" panel shows up in Events Manager.
 *
 * The fix: defensively write our own _fbp / _fbc cookies on first
 * tracking call. Per Meta's spec, `fbq('init')` checks for an
 * existing _fbp cookie and uses it if present (it never overwrites
 * a cookie that's already there). So whichever side fires first wins,
 * and both sides agree on the same value. Browser Pixel and CAPI
 * naturally share the cookie.
 *
 * Same cookie names as Meta (_fbp, _fbc) are used intentionally —
 * Meta's docs guarantee Pixel-side compatibility. anon_id is our own
 * (_1c_anon) and never collides with anything.
 *
 * Spec sources verified before writing:
 *   - https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc
 *   - https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
 */

const FBP_COOKIE = "_fbp"
const FBC_COOKIE = "_fbc"
const ANON_ID_COOKIE = "_1c_anon"
const KNOWN_VISITOR_LS = "_1c_visitor_v1"

/** _fbp / _fbc TTL per Meta spec — 90 days first-party. */
const FB_COOKIE_TTL_DAYS = 90
/** anon_id persists much longer so cross-session attribution survives. */
const ANON_ID_TTL_DAYS = 365

/** Module-level config set by setTrackingDefaults — used by getKnownVisitor
 *  to default country when the storefront knows it (e.g. alenika is BG-only). */
let defaultCountry: string | undefined

/**
 * Configure tracking defaults once on app init. Storefront should call
 * this in a top-level client component (e.g. TrackInit) so the value
 * is set before any fireCapiEvent.
 */
export function setTrackingDefaults(opts: { country?: string }): void {
  if (opts.country) defaultCountry = opts.country.toLowerCase()
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined"
}

function getCookie(name: string): string | undefined {
  if (!isBrowser()) return undefined
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
  if (!match) return undefined
  const value = match.split("=").slice(1).join("=")
  return value || undefined
}

function setCookie(name: string, value: string, days: number): void {
  if (!isBrowser()) return
  const maxAge = days * 24 * 60 * 60
  // SameSite=Lax + Secure — first-party cookie scoped to root path.
  // Lax allows top-level navigation from external referrers (Meta ads
  // landing) which is exactly when fbclid arrives. Secure required by
  // modern browsers for any cookie with SameSite specified.
  document.cookie = `${name}=${value}; max-age=${maxAge}; path=/; SameSite=Lax; Secure`
}

function randomHex(bytes: number): string {
  if (isBrowser() && typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(bytes)
    crypto.getRandomValues(buf)
    return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("")
  }
  // SSR / very old browser fallback. Never reached in practice but
  // keeps the function total.
  return Math.random().toString(16).slice(2, 2 + bytes * 2)
}

/**
 * Get or create the _fbp cookie.
 *
 * Meta spec format: `fb.1.<creation_time_ms>.<random_64bit>`
 *   - "fb"      = literal prefix
 *   - "1"       = subdomain index (1 = root domain like example.com)
 *   - <ms>      = creation time in Unix milliseconds
 *   - <random>  = 64-bit unsigned integer (16 hex chars covers it)
 */
export function getOrCreateFbp(): string | undefined {
  const existing = getCookie(FBP_COOKIE)
  if (existing) return existing
  if (!isBrowser()) return undefined

  const created = `fb.1.${Date.now()}.${randomHex(8)}`
  setCookie(FBP_COOKIE, created, FB_COOKIE_TTL_DAYS)
  return created
}

/**
 * Get or create the _fbc cookie. Reads `?fbclid=…` from the URL on
 * first visit and constructs the cookie ourselves — Meta's Pixel
 * does this too, but only when fbevents.js loads BEFORE the visitor
 * navigates away from the landing URL. Doing it ourselves on the
 * first tracking call captures fbclid even when the Pixel races us.
 *
 * Format: `fb.1.<creation_time_ms>.<fbclid>` — same subdomain index
 * as _fbp.
 *
 * Returns undefined if no cookie exists AND no fbclid is in the URL —
 * not every visitor came from a Meta ad, and we don't fabricate fbc.
 */
export function getOrCreateFbc(): string | undefined {
  const existing = getCookie(FBC_COOKIE)
  if (existing) return existing
  if (!isBrowser()) return undefined

  const params = new URLSearchParams(window.location.search)
  const fbclid = params.get("fbclid")
  if (!fbclid) return undefined

  const created = `fb.1.${Date.now()}.${fbclid}`
  setCookie(FBC_COOKIE, created, FB_COOKIE_TTL_DAYS)
  return created
}

/**
 * Get or create the anonymous-visitor identifier.
 *
 * Sent as `external_id` on every CAPI event for guests, and continues
 * to be sent alongside `customer_id` once the visitor signs up. Meta
 * accepts external_id as an array, so both can coexist — improves
 * dedup AND links pre-signup browsing to the customer once they
 * identify themselves. Solves the "Other dedup keys: 0%" gap from
 * the Events Manager dedup panel.
 *
 * Stored in a cookie (NOT just localStorage) so the Next.js server
 * can read it via cookies() in get-tracking-attribution and write
 * it to cart.metadata for the order.placed subscriber.
 */
export function getOrCreateAnonId(): string | undefined {
  const existing = getCookie(ANON_ID_COOKIE)
  if (existing) return existing
  if (!isBrowser()) return undefined

  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${randomHex(4)}-${randomHex(2)}-${randomHex(2)}-${randomHex(2)}-${randomHex(6)}`
  setCookie(ANON_ID_COOKIE, id, ANON_ID_TTL_DAYS)
  return id
}

/**
 * Visitor PII we know about and want sent on every subsequent CAPI
 * event. Populated by the storefront via rememberKnownVisitor() when
 * the visitor types their email in checkout, signs up via the popup,
 * or logs in. Backend hashes these at the boundary — we store RAW so
 * Pixel Advanced Matching can also use them (Pixel hashes them with
 * its own internal logic).
 */
export type KnownVisitor = {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export function getKnownVisitor(): KnownVisitor {
  let stored: KnownVisitor = {}
  if (isBrowser()) {
    try {
      const raw = window.localStorage.getItem(KNOWN_VISITOR_LS)
      if (raw) stored = JSON.parse(raw) as KnownVisitor
    } catch {
      // localStorage unavailable / parse error — return empty
    }
  }
  // Default country when storefront set one via setTrackingDefaults
  // (e.g. alenika is BG-only). Lifts country coverage to ~100%
  // without per-callsite plumbing.
  if (!stored.country && defaultCountry) {
    stored = { ...stored, country: defaultCountry }
  }
  return stored
}

/**
 * Persist visitor PII for use on subsequent events. Merges with what's
 * already stored — caller passes only the fields they newly know.
 */
export function rememberKnownVisitor(update: KnownVisitor): void {
  if (!isBrowser()) return
  try {
    const current = getKnownVisitor()
    const next: KnownVisitor = { ...current }
    for (const [k, v] of Object.entries(update)) {
      if (typeof v === "string" && v.trim().length > 0) {
        ;(next as Record<string, string>)[k] = v.trim()
      }
    }
    window.localStorage.setItem(KNOWN_VISITOR_LS, JSON.stringify(next))
  } catch {
    // localStorage write failure — silently ignore
  }
}

/**
 * SHA-256 → lowercase hex via Web Crypto. Used by Pixel Advanced
 * Matching helper to pre-hash em / ph before passing to fbq('init').
 * Mirrors backend hashSHA256 (in src/lib/facebook-capi.ts) so client
 * and server hashes of the same input produce the same digest.
 */
export async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const buffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Normalise an email for hashing per Meta CAPI spec: trim, lowercase.
 * Mirrors `trim()` in backend buildCapiUserData → `out.em`.
 */
export function normaliseEmailForHash(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Normalise a phone for hashing per Meta CAPI spec: digits only,
 * country-code prefixed. Mirrors backend normalizePhoneForCapi —
 * BG default (+359) when a 10-digit national number with leading 0
 * is detected.
 */
export function normalisePhoneForHash(raw: string): string {
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = "359" + digits.slice(1)
  }
  return digits
}
