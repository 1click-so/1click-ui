/**
 * Translates raw Stripe / Medusa / network error strings into
 * user-friendly Bulgarian copy for the checkout payment surface.
 *
 * Why this exists: Stripe and Medusa errors are technical English
 * strings ("Your card's security code is incorrect.", "Cart is already
 * completed", "fetch failed"). Showing them to a Bulgarian shopper at
 * the moment of payment failure is the worst UX surface possible — it
 * looks like the site is broken, not like the customer made a typo.
 * This module maps known error shapes to actionable BG sentences and
 * falls back to a generic "try again or contact support" message.
 *
 * The mapping is deliberately narrow. We only translate errors we
 * recognize and trust. Unknown errors get the generic fallback —
 * showing a half-translated message is worse than a clean fallback.
 */

type ErrorContext = "card" | "cod"

const GENERIC_CARD =
  "Плащането не може да бъде обработено в момента. Моля, опитайте отново или изберете друг метод на плащане."

const GENERIC_COD =
  "Поръчката не може да бъде финализирана в момента. Моля, опитайте отново след малко."

/**
 * Map of Stripe error codes / decline codes / common substrings to BG copy.
 * Substring match is case-insensitive. First match wins, so order from
 * most-specific to most-generic.
 *
 * Stripe error code reference:
 * https://docs.stripe.com/error-codes
 */
const STRIPE_PATTERNS: Array<{ match: RegExp; copy: string }> = [
  // Card declined — generic
  {
    match: /card[\s_-]?declined|card_declined/i,
    copy: "Картата е отказана от банката. Моля, опитайте с друга карта или се свържете с банката си.",
  },
  // Insufficient funds
  {
    match: /insufficient[\s_]?funds/i,
    copy: "Недостатъчна наличност по картата. Моля, опитайте с друга карта.",
  },
  // Expired card
  {
    match: /expired[\s_]?card|card[\s_]?has[\s_]?expired/i,
    copy: "Картата е изтекла. Моля, опитайте с друга карта.",
  },
  // Wrong CVC / security code
  {
    match: /incorrect[\s_]?cvc|invalid[\s_]?cvc|cvc[\s_]?check/i,
    copy: "Невалиден код за сигурност (CVC). Моля, проверете трите цифри на гърба на картата.",
  },
  // Wrong card number
  {
    match: /incorrect[\s_]?number|invalid[\s_]?number/i,
    copy: "Невалиден номер на карта. Моля, проверете цифрите.",
  },
  // Wrong / invalid expiry
  {
    match: /invalid[\s_]?expir|incorrect[\s_]?expir/i,
    copy: "Невалидна дата на изтичане. Моля, проверете месеца и годината.",
  },
  // 3DS / authentication required
  {
    match: /authentication[\s_]?required|3d[\s_]?secure/i,
    copy: "Банката изисква допълнително потвърждение. Моля, следвайте инструкциите.",
  },
  // Processing error
  {
    match: /processing[\s_]?error/i,
    copy: "Грешка при обработка на картата. Моля, опитайте отново след малко.",
  },
  // Rate limit
  {
    match: /rate[\s_]?limit/i,
    copy: "Твърде много опити за плащане. Моля, изчакайте няколко минути и опитайте отново.",
  },
  // Terminal-state PI (the bug we're hardening against)
  {
    match: /terminal[\s_]?state|payment[\s_]?intent[\s_]?(?:is|in)[\s_]?(?:a[\s_]?)?terminal/i,
    copy: "Сесията за плащане е изтекла. Моля, презаредете страницата и опитайте отново.",
  },
  // Amount mismatch — happens when cart total drifts from PI amount
  {
    match: /amount[\s_]?mismatch|amount[\s_]?does[\s_]?not[\s_]?match/i,
    copy: "Сумата на поръчката се промени. Моля, презаредете страницата и опитайте отново.",
  },
  // Network / fetch failure
  {
    match: /failed[\s_]?to[\s_]?fetch|network[\s_]?error|networkerror/i,
    copy: "Няма връзка със сървъра. Моля, проверете интернет връзката и опитайте отново.",
  },
]

const MEDUSA_PATTERNS: Array<{ match: RegExp; copy: string }> = [
  // Cart already completed — likely a double-submit racing through
  {
    match: /cart[\s_]?(?:is[\s_]?)?already[\s_]?completed|already[\s_]?an[\s_]?order/i,
    copy: "Тази поръчка вече беше финализирана. Моля, проверете имейла си за потвърждение.",
  },
  // Out of stock
  {
    match: /not[\s_]?enough[\s_]?stock|insufficient[\s_]?stock|out[\s_]?of[\s_]?stock/i,
    copy: "Един от продуктите вече не е наличен в избраното количество. Моля, обновете количката.",
  },
  // Region / country mismatch
  {
    match: /no[\s_]?region|invalid[\s_]?region/i,
    copy: "Регионът на доставка не е валиден. Моля, презаредете страницата.",
  },
  // No shipping method
  {
    match: /no[\s_]?shipping[\s_]?method|shipping[\s_]?method[\s_]?not[\s_]?found/i,
    copy: "Изберете метод на доставка преди да продължите.",
  },
]

/**
 * Translate any thrown / returned error into customer-facing Bulgarian.
 *
 * @param err - the error from a try/catch or a Stripe error response
 * @param context - "card" for Stripe path, "cod" for manual path
 */
export function translatePaymentError(
  err: unknown,
  context: ErrorContext
): string {
  const raw = extractMessage(err)
  if (!raw) return context === "card" ? GENERIC_CARD : GENERIC_COD

  for (const { match, copy } of STRIPE_PATTERNS) {
    if (match.test(raw)) return copy
  }
  for (const { match, copy } of MEDUSA_PATTERNS) {
    if (match.test(raw)) return copy
  }
  return context === "card" ? GENERIC_CARD : GENERIC_COD
}

function extractMessage(err: unknown): string {
  if (!err) return ""
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  if (typeof err === "object" && err !== null) {
    const e = err as {
      message?: string
      code?: string
      decline_code?: string
      type?: string
    }
    return [e.message, e.code, e.decline_code, e.type]
      .filter(Boolean)
      .join(" ")
  }
  return String(err)
}
