/**
 * Translates raw Medusa promotion errors into user-friendly Bulgarian copy
 * for the checkout discount-code surface.
 *
 * Why this exists: applying a promo code is the one checkout action a
 * shopper triggers speculatively — they type a half-remembered code and
 * hope. So it FAILS often, by design. Medusa returns technical English
 * ("The promotion code WELCOME is invalid", "Attribute value for
 * customer_email is required by promotion campaign budget"), and — worse —
 * when the failure surfaces during the post-update `refresh()` re-render,
 * the shopper sees Next.js's raw production string ("An error occurred in
 * the Server Components render…"). Either way it reads as "the site is
 * broken" at the highest-intent moment.
 *
 * This maps the known promo error shapes to actionable BG sentences and
 * falls back to a clean generic message. Mirrors payment-error-copy.ts /
 * address-error-copy.ts — same narrow, trust-only matching.
 */

/** Generic fallback — used when we can't recognise the error at all. */
const GENERIC =
  "Кодът за отстъпка не може да бъде приложен в момента. Моля, проверете кода и опитайте отново."

/** Campaign-budget promotions are tracked per customer, so Medusa requires
 * an email on the cart before it can apply them. A shopper who jumps
 * straight to the promo field without filling their details hits this. */
const NEEDS_EMAIL =
  "Въведете имейл адрес по-горе, за да приложите този код за отстъпка."

const INVALID = "Този код за отстъпка не е валиден."

const EXPIRED = "Този код за отстъпка вече не е активен."

const EXHAUSTED =
  "Промоцията е изчерпана и вече не може да бъде използвана."

/**
 * Known promo error substrings → BG copy. Case-insensitive, first match
 * wins, most-specific first.
 */
const PROMO_PATTERNS: Array<{ match: RegExp; copy: string }> = [
  // Campaign budget needs an email on the cart. Match the raw Medusa text
  // for the case where it reaches us directly (clean 4xx/5xx with message).
  {
    match: /customer_email|campaign[\s_]?budget/i,
    copy: NEEDS_EMAIL,
  },
  // Expired / no-longer-active promotion.
  {
    match: /expired|no[\s_]?longer[\s_]?(?:active|valid)/i,
    copy: EXPIRED,
  },
  // Budget / usage limit reached.
  {
    match: /reached[\s_]?its[\s_]?limit|usage[\s_]?limit|budget[\s_]?(?:exceeded|reached)/i,
    copy: EXHAUSTED,
  },
  // Invalid / unknown code (keep last of the specific set — broadest).
  {
    match: /is[\s_]?invalid|invalid[\s_]?data|not[\s_]?found|does(?:n'?t| not)[\s_]?exist/i,
    copy: INVALID,
  },
]

/**
 * Translate any thrown / returned promo error into customer-facing Bulgarian.
 *
 * @param err  the error from a try/catch (may be an opaque Next.js RSC
 *             render error whose message leaks nothing — that's expected)
 * @param opts.hasEmail  whether the cart currently has an email. When the
 *             error is opaque (the RSC case) and there's no email, the
 *             overwhelmingly likely cause is a campaign-budget promo, so we
 *             give the actionable "enter your email" message instead of a
 *             vague fallback.
 */
export function translatePromotionError(
  err: unknown,
  opts?: { hasEmail?: boolean }
): string {
  const raw = extractMessage(err)

  for (const { match, copy } of PROMO_PATTERNS) {
    if (match.test(raw)) return copy
  }

  // Unknown / opaque error (e.g. the production RSC-render string). If the
  // cart has no email yet, the campaign-budget case is by far the most
  // common trigger — point the shopper at the fix rather than a dead end.
  if (opts?.hasEmail === false) return NEEDS_EMAIL

  return GENERIC
}

function extractMessage(err: unknown): string {
  if (!err) return ""
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  if (typeof err === "object" && err !== null) {
    const e = err as { message?: string; code?: string; type?: string }
    return [e.message, e.code, e.type].filter(Boolean).join(" ")
  }
  return String(err)
}
