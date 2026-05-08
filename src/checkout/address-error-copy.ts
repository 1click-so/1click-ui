/**
 * Translates raw Medusa / Next.js / network error strings into
 * user-friendly Bulgarian copy for the checkout address surface.
 *
 * Why this exists: when the cart-update server action throws during
 * auto-save (typo in email, bad postal code, dropped network), the
 * orchestration's catch block surfaces the raw English error inline
 * via <ErrorMessage />. In production a Server Action throw arrives
 * as the canned Next.js "An error occurred in the Server Components
 * render. The specific message is omitted in production builds…"
 * which is doubly useless — English AND content-free.
 *
 * Mirrors the shape of `payment-error-copy.ts`. The mapping is
 * deliberately narrow: only translate errors we recognize; everything
 * else falls back to a clean generic message rather than half-
 * translated text.
 *
 * To find new errors to add: each occurrence is now logged to
 * checkout_error_log with `error_type='address_save_failed'` and the
 * Vercel digest in `context.digest`. Match the digest against Vercel
 * runtime logs to recover the underlying Medusa rejection text, then
 * add a pattern here.
 */

const GENERIC_FALLBACK =
  "Възникна проблем при запазване на адреса. Моля, проверете данните и опитайте отново."

const NETWORK_FALLBACK =
  "Няма връзка със сървъра. Моля, проверете интернет връзката и опитайте отново."

/**
 * Patterns matched in order — first match wins. List most specific
 * first, generic last. Match is case-insensitive (regexes carry /i).
 */
const PATTERNS: Array<{ match: RegExp; copy: string }> = [
  // Email validation — confirmed in Vercel logs as the most common
  // address-save failure. Medusa returns "Invalid request: Invalid email."
  {
    match: /invalid[\s_]?(?:request:?\s*)?invalid[\s_]?email|invalid[\s_]?email/i,
    copy: "Невалиден имейл адрес. Моля, проверете изписването.",
  },
  // Postal / postcode validation
  {
    match: /invalid[\s_]?postal|invalid[\s_]?post(?:code|al[\s_]?code)|postal[\s_]?code[\s_]?(?:is[\s_]?)?invalid/i,
    copy: "Невалиден пощенски код. Моля, въведете 4-цифрен код.",
  },
  // Phone validation
  {
    match: /invalid[\s_]?phone|phone[\s_]?(?:number[\s_]?)?(?:is[\s_]?)?invalid/i,
    copy: "Невалиден телефонен номер. Моля, проверете цифрите.",
  },
  // Country / region mismatch
  {
    match: /invalid[\s_]?country|country[\s_]?(?:code[\s_]?)?(?:is[\s_]?)?invalid|no[\s_]?region|invalid[\s_]?region/i,
    copy: "Невалидна държава. Моля, презаредете страницата.",
  },
  // Cart already completed — race with order placement
  {
    match: /cart[\s_]?(?:is[\s_]?)?already[\s_]?completed|already[\s_]?an[\s_]?order/i,
    copy: "Поръчката вече е финализирана. Моля, проверете имейла си за потвърждение.",
  },
  // Cart not found / expired
  {
    match: /cart[\s_]?(?:not[\s_]?found|does[\s_]?not[\s_]?exist|expired)/i,
    copy: "Сесията на количката изтече. Моля, презаредете страницата.",
  },
  // Network / fetch failure
  {
    match: /failed[\s_]?to[\s_]?fetch|network[\s_]?error|networkerror|econnreset|etimedout/i,
    copy: NETWORK_FALLBACK,
  },
  // The Next.js canned Server Components production message — surface
  // a clean fallback instead of the English placeholder. The actual
  // cause is now in checkout_error_log via context.digest.
  {
    match: /server[\s_]?components[\s_]?render|digest property is included/i,
    copy: GENERIC_FALLBACK,
  },
]

/**
 * Translate any thrown / returned address-save error into
 * customer-facing Bulgarian copy. Returns the generic fallback when
 * the error doesn't match a known pattern.
 */
export function translateAddressError(err: unknown): string {
  const raw = extractMessage(err)
  if (!raw) return GENERIC_FALLBACK

  for (const { match, copy } of PATTERNS) {
    if (match.test(raw)) return copy
  }
  return GENERIC_FALLBACK
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
