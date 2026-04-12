"use client"

/**
 * ErrorMessage — tiny inline error text component used throughout the
 * checkout. Returns null when there is no error so it can be rendered
 * unconditionally alongside forms.
 *
 * Extracted from mindpages-storefront
 * src/modules/checkout/components/error-message/index.tsx.
 */

export function ErrorMessage({
  error,
  "data-testid": dataTestid,
}: {
  error?: string | null
  "data-testid"?: string
}) {
  if (!error) return null
  return (
    <div className="pt-2 text-destructive text-xs" data-testid={dataTestid}>
      <span>{error}</span>
    </div>
  )
}
