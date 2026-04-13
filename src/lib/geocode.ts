/**
 * Shared geo helpers used by Bulgarian fulfillment selectors (Econt, BoxNow).
 *
 * Extracted from the original EcontOfficeSelector so multiple provider
 * selectors can rank pickup points by distance to the user's address
 * without duplicating the haversine + Nominatim + Bulgarian-address-cleaner
 * logic.
 *
 * Nominatim usage is rate-limited (1 req/s/IP per their ToS); for a
 * typical checkout we only call once per address change, well under the
 * limit.
 */

export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

/**
 * cleanAddress — strip Bulgarian address prefixes/suffixes (ул., бул.,
 * вх., ет., ап., etc.) to give Nominatim a better chance at a hit.
 */
export function cleanAddress(raw: string): string {
  return raw
    .replace(/^(ул|ul)\.?\s*/i, "")
    .replace(/^(бул|bul)\.?\s*/i, "")
    .replace(/^(пл|pl)\.?\s*/i, "")
    .replace(/^(жк|zhk|jk)\.?\s*/i, "")
    .replace(/^(ж\.к|zh\.k)\.?\s*/i, "")
    .replace(/^(кв|kv)\.?\s*/i, "")
    .replace(/^(с|s)\.?\s+/i, "")
    .replace(/^(гр|gr)\.?\s*/i, "")
    .replace(/[„""()]/g, "")
    .replace(
      /\s*[,;]?\s*(вх|vh|ет|et|fl|ап|ap|apt|офис|office|стая|room|секция|корпус|каб|entr|entrance)\.?\s*.*/i,
      ""
    )
    .replace(/\s*(бл|bl|block)\.?\s*(\d+)\s*.*/i, " $2")
    .replace(/(\d+)\s*[А-Яа-яA-Za-z]$/, "$1")
    .replace(/[,.\s]+$/, "")
    .trim()
}

/**
 * geocodeAddress — hit OpenStreetMap Nominatim for a Bulgarian address.
 * Returns { lat, lng } or null when no hit / network error.
 */
export async function geocodeAddress(
  city: string,
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const cleaned = cleanAddress(address)
    const numMatch = cleaned.match(/^(.+?)\s+(\d+\S*)$/)
    const street = numMatch ? `${numMatch[2]} ${numMatch[1]}` : cleaned

    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("city", city)
    url.searchParams.set("street", street)
    url.searchParams.set("country", "Bulgaria")
    url.searchParams.set("format", "json")
    url.searchParams.set("limit", "1")

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "1click-ui/1.0" },
    })
    const data = await res.json()
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
    return null
  } catch {
    return null
  }
}
