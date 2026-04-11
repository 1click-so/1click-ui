/**
 * Compare two address objects for shallow equality across the canonical
 * shipping-address fields. Returns true if every field matches.
 *
 * Extracted from mindpages-storefront src/lib/util/compare-addresses.ts.
 * Rewritten without lodash (isEqual + pick) to keep the library bundle slim.
 */

const FIELDS = [
  "first_name",
  "last_name",
  "address_1",
  "company",
  "postal_code",
  "city",
  "country_code",
  "province",
  "phone",
] as const

type AddressLike = Record<string, unknown> | null | undefined

export default function compareAddresses(
  address1: AddressLike,
  address2: AddressLike
): boolean {
  if (address1 === address2) return true
  if (!address1 || !address2) return false

  for (const key of FIELDS) {
    const a = (address1 as Record<string, unknown>)[key] ?? null
    const b = (address2 as Record<string, unknown>)[key] ?? null
    if (a !== b) return false
  }

  return true
}
