"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { cn } from "../lib/utils"
import {
  distanceMeters,
  formatDistance,
  geocodeAddress,
  normalizeForMatch,
} from "../lib/geocode"
import { listPigeonOffices } from "../data/pigeon"
import type { PigeonOffice } from "../data/pigeon-types"
import { useCheckoutLabels } from "./context"

/**
 * PigeonOfficeSelector — office picker for Pigeon Express delivery.
 *
 * Mirrors BoxNowLockerSelector's UX 1:1 (loading spinner, selected pill,
 * "search for another" expandable, nearest-3 by haversine distance) and
 * fetches from our backend's /store/integrations/pigeon/offices proxy —
 * Pigeon's office API is credentialed, so unlike Econt the browser can
 * never call the carrier directly.
 *
 * Data shape differences from BoxNow handled here:
 *  - name (not title) and a real `city` field, so the city-lock filters
 *    on the actual city instead of sniffing address lines
 *  - id is Pigeon's NUMERIC catalogue id — the waybill needs it verbatim
 *  - city_id forwarded so the backend can skip a city lookup
 *
 * Lockers are deliberately absent: Pigeon АПС delivery starts only after
 * the merchant's new contract, and the backend proxy serves offices only.
 *
 * Edge cases (503/502/empty) show a single "временно недостъпен" message.
 */

export type { PigeonOffice }

type PigeonOfficeSelectorProps = {
  userCity: string
  userAddress: string
  selectedOffice: PigeonOffice | null
  onSelect: (office: PigeonOffice | null) => void
}

type OfficesState =
  | { status: "loading" }
  | { status: "ready"; offices: PigeonOffice[] }
  | { status: "error" }

// Module-level cache so switching between shipping rows doesn't re-hit
// the backend on every toggle.
let officesCache: PigeonOffice[] | null = null
let officesPromise: Promise<PigeonOffice[] | null> | null = null

async function fetchOffices(): Promise<PigeonOffice[] | null> {
  if (officesCache) return officesCache
  if (officesPromise) return officesPromise

  officesPromise = listPigeonOffices().then((res) => {
    if (!res.ok) return null
    officesCache = res.offices
    return officesCache
  })

  return officesPromise
}

export function PigeonOfficeSelector({
  userCity,
  userAddress,
  selectedOffice,
  onSelect,
}: PigeonOfficeSelectorProps) {
  const labels = useCheckoutLabels()
  const [officesState, setOfficesState] = useState<OfficesState>({
    status: "loading",
  })
  const [userCoords, setUserCoords] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    setOfficesState({ status: "loading" })
    Promise.all([
      fetchOffices(),
      userCity && userAddress
        ? geocodeAddress(userCity, userAddress)
        : Promise.resolve(null),
    ]).then(([fetchedOffices, coords]) => {
      if (!fetchedOffices || fetchedOffices.length === 0) {
        setOfficesState({ status: "error" })
      } else {
        setOfficesState({ status: "ready", offices: fetchedOffices })
      }
      setUserCoords(coords)
    })
  }, [userCity, userAddress])

  const offices = officesState.status === "ready" ? officesState.offices : []

  // City-lock: every list (nearest + search) is restricted to the user's
  // checkout city. Pigeon offices carry a real `city` field, so no
  // address-line sniffing is needed. If the user hasn't entered a city
  // yet, fall back to all offices so the UI doesn't render empty.
  //
  // Both sides are transliterated Cyrillic→Latin so "Sofia" matches
  // "София" and vice versa. Idempotent on already-Latin input.
  const cityNormalized = normalizeForMatch(userCity.trim())
  const cityLockedOffices = useMemo(() => {
    if (!cityNormalized) return offices
    return offices.filter((o) =>
      normalizeForMatch(o.city ?? "").includes(cityNormalized)
    )
  }, [offices, cityNormalized])

  const nearestOffices = useMemo(() => {
    if (!cityLockedOffices.length) return []

    const geocodedOffices = cityLockedOffices.filter(
      (o) =>
        typeof o.lat === "number" &&
        typeof o.lng === "number" &&
        !Number.isNaN(o.lat) &&
        !Number.isNaN(o.lng)
    )

    if (userCoords && geocodedOffices.length > 0) {
      return geocodedOffices
        .map((o) => ({
          office: o,
          distance: distanceMeters(
            userCoords.lat,
            userCoords.lng,
            o.lat as number,
            o.lng as number
          ),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
    }

    // No coords available — just show the first 3 city-locked offices.
    return cityLockedOffices
      .slice(0, 3)
      .map((o) => ({ office: o, distance: 0 }))
  }, [cityLockedOffices, userCoords])

  const searchResults = useMemo(() => {
    if (!search.trim() || search.trim().length < 2) return []
    // Normalize query and office fields through Cyrillic→Latin so the
    // user can search "Vitosha" and match "Витоша" (and vice versa).
    const q = normalizeForMatch(search.trim())
    // Search is also city-locked — only offices in the user's city.
    // Uncapped; container scrolls.
    return cityLockedOffices.filter((o) => {
      const name = normalizeForMatch(o.name ?? "")
      const address = normalizeForMatch(o.address ?? "")
      const city = normalizeForMatch(o.city ?? "")
      const postal = (o.postal_code ?? "").toLowerCase()
      return (
        name.includes(q) ||
        address.includes(q) ||
        city.includes(q) ||
        postal.includes(q)
      )
    })
  }, [cityLockedOffices, search])

  const renderOffice = useCallback(
    (office: PigeonOffice, distance: number | null, isSelected: boolean) => (
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
          isSelected ? "bg-primary/10" : "bg-card hover:bg-muted"
        )}
        style={
          isSelected
            ? { boxShadow: "inset 0 0 0 1.5px oklch(var(--primary))" }
            : undefined
        }
      >
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg
            className="w-4 h-4 text-muted-foreground"
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
          <p className="text-sm font-medium text-foreground leading-tight">
            {office.name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {office.address}
            {office.city ? `, ${office.city}` : ""}
            {office.postal_code ? `, ${office.postal_code}` : ""}
          </p>
        </div>

        {distance !== null && distance > 0 && (
          <span className="text-xs font-medium text-muted-foreground flex-shrink-0 mt-1">
            {formatDistance(distance)}
          </span>
        )}
      </button>
    ),
    [onSelect]
  )

  if (officesState.status === "loading") {
    return (
      <div className="px-4 py-6 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-border border-t-text-muted rounded-full animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">
          {labels.pigeonLoadingOffices}
        </span>
      </div>
    )
  }

  if (officesState.status === "error") {
    return (
      <div className="px-4 py-4">
        <div className="p-3 rounded-lg bg-muted border border-border">
          <p className="text-sm text-muted-foreground">
            {labels.pigeonUnavailable}
          </p>
        </div>
      </div>
    )
  }

  // User's city has no offices — explicit dead-end message so they pick
  // a different shipping method instead of staring at silence.
  if (cityNormalized && cityLockedOffices.length === 0 && !selectedOffice) {
    return (
      <div className="px-4 py-4">
        <div className="p-3 rounded-lg bg-muted border border-border">
          <p className="text-sm text-muted-foreground">
            {labels.pigeonNoOfficesInCity}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 pt-2 space-y-3">
      {selectedOffice && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg">
          <svg
            className="w-4 h-4 text-primary flex-shrink-0"
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
          <p className="text-sm font-medium text-primary">
            {selectedOffice.name}
          </p>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="ml-auto text-xs text-primary hover:underline"
          >
            {labels.pigeonChange}
          </button>
        </div>
      )}

      {!selectedOffice && nearestOffices.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {labels.pigeonNearestOffices}
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
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
              {labels.pigeonSearchAnother}
            </button>
          ) : (
            <div>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
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
                  placeholder={labels.pigeonSearchPlaceholder}
                  className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  autoFocus
                />
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-[240px] overflow-y-auto">
                  {searchResults.map((office) =>
                    renderOffice(office, null, false)
                  )}
                </div>
              )}

              {search.trim().length >= 2 && searchResults.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground text-center py-3">
                  {labels.pigeonNoResults} "{search}"
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
