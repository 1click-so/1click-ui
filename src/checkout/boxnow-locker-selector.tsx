"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { cn } from "../lib/utils"
import {
  distanceMeters,
  formatDistance,
  geocodeAddress,
  normalizeForMatch,
} from "../lib/geocode"
import { listBoxNowLockers } from "../data/boxnow"
import type { BoxNowLocker } from "../data/boxnow-types"
import { useCheckoutLabels } from "./context"

/**
 * BoxNowLockerSelector — full BoxNow locker picker for Bulgarian shipping.
 *
 * Mirrors EcontOfficeSelector's UX 1:1 (loading spinner, selected pill,
 * "search for another" expandable, nearest-3 by haversine distance) but
 * fetches from our backend's /store/integrations/boxnow/lockers endpoint
 * instead of Econt's public Nomenclatures URL. Backend owns BoxNow API
 * auth + 10-min cache; we get a pre-flattened list.
 *
 * Data shape differences from Econt handled here:
 *  - title (not name)
 *  - addressLine1 / addressLine2 (not address.street/num)
 *  - postalCode (not address.city.name)
 *  - lat / lng on the root (not address.location.latitude/longitude)
 *  - No isAPS / code / phones
 *
 * Edge cases (503/502/empty) show a single "временно недостъпно" message.
 */

export type { BoxNowLocker }

type BoxNowLockerSelectorProps = {
  userCity: string
  userAddress: string
  selectedLocker: BoxNowLocker | null
  onSelect: (locker: BoxNowLocker | null) => void
}

type LockersState =
  | { status: "loading" }
  | { status: "ready"; lockers: BoxNowLocker[] }
  | { status: "error" }

// Module-level cache so switching between shipping rows doesn't re-hit
// the backend on every toggle.
let lockersCache: BoxNowLocker[] | null = null
let lockersPromise: Promise<BoxNowLocker[] | null> | null = null

async function fetchLockers(): Promise<BoxNowLocker[] | null> {
  if (lockersCache) return lockersCache
  if (lockersPromise) return lockersPromise

  lockersPromise = listBoxNowLockers().then((res) => {
    if (!res.ok) return null
    lockersCache = res.lockers
    return lockersCache
  })

  return lockersPromise
}

export function BoxNowLockerSelector({
  userCity,
  userAddress,
  selectedLocker,
  onSelect,
}: BoxNowLockerSelectorProps) {
  const labels = useCheckoutLabels()
  const [lockersState, setLockersState] = useState<LockersState>({
    status: "loading",
  })
  const [userCoords, setUserCoords] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    setLockersState({ status: "loading" })
    Promise.all([
      fetchLockers(),
      userCity && userAddress
        ? geocodeAddress(userCity, userAddress)
        : Promise.resolve(null),
    ]).then(([fetchedLockers, coords]) => {
      if (!fetchedLockers || fetchedLockers.length === 0) {
        setLockersState({ status: "error" })
      } else {
        setLockersState({ status: "ready", lockers: fetchedLockers })
      }
      setUserCoords(coords)
    })
  }, [userCity, userAddress])

  const lockers =
    lockersState.status === "ready" ? lockersState.lockers : []

  // City-lock: every list (nearest + search) is restricted to the user's
  // checkout city. BoxNow stores the city in addressLine2, occasionally
  // in addressLine1 too. If the user hasn't entered a city yet, fall
  // back to all lockers so the UI doesn't render empty on first paint.
  //
  // Both sides are transliterated Cyrillic→Latin so "Sofia" matches
  // "София" and vice versa. Idempotent on already-Latin input.
  const cityNormalized = normalizeForMatch(userCity.trim())
  const cityLockedLockers = useMemo(() => {
    if (!cityNormalized) return lockers
    return lockers.filter((l) => {
      const line1 = normalizeForMatch(l.addressLine1 ?? "")
      const line2 = normalizeForMatch(l.addressLine2 ?? "")
      return line2.includes(cityNormalized) || line1.includes(cityNormalized)
    })
  }, [lockers, cityNormalized])

  const nearestLockers = useMemo(() => {
    if (!cityLockedLockers.length) return []

    const geocodedLockers = cityLockedLockers.filter(
      (l) =>
        typeof l.lat === "number" &&
        typeof l.lng === "number" &&
        !Number.isNaN(l.lat) &&
        !Number.isNaN(l.lng)
    )

    if (userCoords && geocodedLockers.length > 0) {
      return geocodedLockers
        .map((l) => ({
          locker: l,
          distance: distanceMeters(userCoords.lat, userCoords.lng, l.lat, l.lng),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
    }

    // No coords available — just show the first 3 city-locked lockers.
    return cityLockedLockers
      .slice(0, 3)
      .map((l) => ({ locker: l, distance: 0 }))
  }, [cityLockedLockers, userCoords])

  const searchResults = useMemo(() => {
    if (!search.trim() || search.trim().length < 2) return []
    // Normalize query and locker fields through Cyrillic→Latin so the
    // user can search "Vitosha" and match "Витоша" (and vice versa).
    const q = normalizeForMatch(search.trim())
    // Search is also city-locked — only lockers in the user's city.
    // Uncapped; container scrolls.
    return cityLockedLockers.filter((l) => {
      const title = normalizeForMatch(l.title ?? "")
      const line1 = normalizeForMatch(l.addressLine1 ?? "")
      const line2 = normalizeForMatch(l.addressLine2 ?? "")
      const postal = (l.postalCode ?? "").toLowerCase()
      return (
        title.includes(q) ||
        line1.includes(q) ||
        line2.includes(q) ||
        postal.includes(q)
      )
    })
  }, [cityLockedLockers, search])

  const renderLocker = useCallback(
    (locker: BoxNowLocker, distance: number | null, isSelected: boolean) => (
      <button
        key={locker.id}
        type="button"
        onClick={() => {
          onSelect(locker)
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
            {locker.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locker.addressLine1}
            {locker.addressLine2 ? `, ${locker.addressLine2}` : ""}
            {locker.postalCode ? `, ${locker.postalCode}` : ""}
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

  if (lockersState.status === "loading") {
    return (
      <div className="px-4 py-6 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-border border-t-text-muted rounded-full animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">
          {labels.boxnowLoadingLockers}
        </span>
      </div>
    )
  }

  if (lockersState.status === "error") {
    return (
      <div className="px-4 py-4">
        <div className="p-3 rounded-lg bg-muted border border-border">
          <p className="text-sm text-muted-foreground">
            {labels.boxnowUnavailable}
          </p>
        </div>
      </div>
    )
  }

  // User's city has no lockers — explicit dead-end message so they pick
  // a different shipping method instead of staring at silence.
  if (cityNormalized && cityLockedLockers.length === 0 && !selectedLocker) {
    return (
      <div className="px-4 py-4">
        <div className="p-3 rounded-lg bg-muted border border-border">
          <p className="text-sm text-muted-foreground">
            {labels.boxnowNoLockersInCity}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 pt-2 space-y-3">
      {selectedLocker && (
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
            {selectedLocker.title}
          </p>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="ml-auto text-xs text-primary hover:underline"
          >
            {labels.boxnowChange}
          </button>
        </div>
      )}

      {!selectedLocker && nearestLockers.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {labels.boxnowNearestLockers}
          </p>
          <div className="space-y-1.5">
            {nearestLockers.map(({ locker, distance }) =>
              renderLocker(locker, distance, false)
            )}
          </div>
        </div>
      )}

      {!selectedLocker && (
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
              {labels.boxnowSearchAnother}
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
                  placeholder={labels.boxnowSearchPlaceholder}
                  className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  autoFocus
                />
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-[240px] overflow-y-auto">
                  {searchResults.map((locker) =>
                    renderLocker(locker, null, false)
                  )}
                </div>
              )}

              {search.trim().length >= 2 && searchResults.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground text-center py-3">
                  {labels.boxnowNoResults} "{search}"
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
