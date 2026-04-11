"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"

/**
 * EcontOfficeSelector — full Econt office picker for Bulgarian shipping.
 *
 * Behavior:
 * - On mount, fetches the full Econt offices list from the public Econt
 *   Nomenclatures endpoint (cached globally — one fetch per page load).
 * - If the user has entered a shipping address (city + street), geocodes
 *   it via OpenStreetMap Nominatim and sorts the 3 nearest offices by
 *   haversine distance.
 * - If geocoding fails or address is empty, falls back to filtering
 *   offices by city name.
 * - Expanding "Search for another office" lets the user search across
 *   all offices by name/city/street.
 *
 * Bulgarian-specific logic (cleanAddress prefix stripping, Nominatim
 * country="Bulgaria" constraint) stays in this file — it IS intrinsically
 * Bulgarian. Stores that want a different country build their own selector.
 *
 * Extracted from mindpages-storefront
 * src/modules/checkout/components/econt-office-selector/index.tsx.
 */

export type EcontOffice = {
  id: number
  code: string
  name: string
  nameEn: string
  isAPS: boolean
  address: {
    city: { name: string }
    street: string
    num: string
    location: { latitude: number; longitude: number } | null
  }
  phones: string[]
}

type EcontOfficeSelectorProps = {
  userCity: string
  userAddress: string
  selectedOffice: EcontOffice | null
  onSelect: (office: EcontOffice | null) => void
}

function distanceMeters(
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

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

let officesCache: EcontOffice[] | null = null
let officesFetchPromise: Promise<EcontOffice[]> | null = null

async function fetchOffices(): Promise<EcontOffice[]> {
  if (officesCache) return officesCache
  if (officesFetchPromise) return officesFetchPromise

  officesFetchPromise = fetch(
    "https://ee.econt.com/services/Nomenclatures/NomenclaturesService.getOffices.json",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode: "BGR" }),
    }
  )
    .then((r) => r.json())
    .then((d) => {
      officesCache = d.offices || []
      return officesCache!
    })

  return officesFetchPromise
}

function cleanAddress(raw: string): string {
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

async function geocodeAddress(
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

export function EcontOfficeSelector({
  userCity,
  userAddress,
  selectedOffice,
  onSelect,
}: EcontOfficeSelectorProps) {
  const labels = useCheckoutLabels()
  const [offices, setOffices] = useState<EcontOffice[]>([])
  const [userCoords, setUserCoords] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchOffices(),
      userCity && userAddress
        ? geocodeAddress(userCity, userAddress)
        : Promise.resolve(null),
    ]).then(([fetchedOffices, coords]) => {
      setOffices(fetchedOffices)
      setUserCoords(coords)
      setLoading(false)
    })
  }, [userCity, userAddress])

  const nearestOffices = useMemo(() => {
    if (!offices.length) return []

    if (userCoords) {
      return offices
        .filter((o) => o.address?.location?.latitude)
        .map((o) => ({
          office: o,
          distance: distanceMeters(
            userCoords.lat,
            userCoords.lng,
            o.address.location!.latitude,
            o.address.location!.longitude
          ),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
    }

    const cityLower = userCity.toLowerCase()
    const cityOffices = offices.filter(
      (o) => o.address?.city?.name?.toLowerCase() === cityLower
    )
    return cityOffices.slice(0, 3).map((o) => ({ office: o, distance: 0 }))
  }, [offices, userCoords, userCity])

  const searchResults = useMemo(() => {
    if (!search.trim() || search.trim().length < 2) return []
    const q = search.toLowerCase()
    return offices
      .filter(
        (o) =>
          o.name?.toLowerCase().includes(q) ||
          o.address?.city?.name?.toLowerCase().includes(q) ||
          o.address?.street?.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [offices, search])

  const renderOffice = useCallback(
    (office: EcontOffice, distance: number | null, isSelected: boolean) => (
      <button
        key={office.id}
        type="button"
        onClick={() => {
          onSelect(office)
          setShowSearch(false)
          setSearch("")
        }}
        className={cn(
          "flex items-start gap-3 w-full px-3.5 py-3 text-left transition-all duration-150 rounded-lg",
          isSelected ? "bg-accent/10" : "bg-surface hover:bg-surface-muted"
        )}
        style={
          isSelected
            ? { boxShadow: "inset 0 0 0 1.5px hsl(var(--color-accent))" }
            : undefined
        }
      >
        <div className="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg
            className="w-4 h-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-base leading-tight">
            {office.name}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {office.address?.street}
            {office.address?.num ? ` ${office.address.num}` : ""}
            {office.address?.city?.name ? `, ${office.address.city.name}` : ""}
          </p>
        </div>

        {distance !== null && distance > 0 && (
          <span className="text-xs font-medium text-text-subtle flex-shrink-0 mt-1">
            {formatDistance(distance)}
          </span>
        )}
      </button>
    ),
    [onSelect]
  )

  if (loading) {
    return (
      <div className="px-4 py-6 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-border border-t-text-muted rounded-full animate-spin" />
        <span className="ml-2 text-sm text-text-muted">
          {labels.econtLoadingOffices}
        </span>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 pt-2 space-y-3">
      {selectedOffice && (
        <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 border border-accent/30 rounded-lg">
          <svg
            className="w-4 h-4 text-accent flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm font-medium text-accent">{selectedOffice.name}</p>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="ml-auto text-xs text-accent hover:underline"
          >
            {labels.econtChange}
          </button>
        </div>
      )}

      {!selectedOffice && nearestOffices.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
            {labels.econtNearestOffices}
          </p>
          <div className="space-y-1.5">
            {nearestOffices.map(({ office, distance }) =>
              renderOffice(office, distance, false)
            )}
          </div>
        </div>
      )}

      {!selectedOffice && (
        <div>
          {!showSearch ? (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-text-base transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              {labels.econtSearchAnother}
            </button>
          ) : (
            <div>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={labels.econtSearchPlaceholder}
                  className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                  autoFocus
                />
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-[240px] overflow-y-auto">
                  {searchResults.map((office) => renderOffice(office, null, false))}
                </div>
              )}

              {search.trim().length >= 2 && searchResults.length === 0 && (
                <p className="mt-2 text-xs text-text-subtle text-center py-3">
                  {labels.econtNoResults} "{search}"
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
