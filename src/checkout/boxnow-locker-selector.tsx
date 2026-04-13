"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { cn } from "../lib/utils"
import { distanceMeters, formatDistance, geocodeAddress } from "../lib/geocode"
import { listBoxNowLockers, type BoxNowLocker } from "../data/boxnow"
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

  const nearestLockers = useMemo(() => {
    if (!lockers.length) return []

    if (userCoords) {
      return lockers
        .filter((l) => typeof l.lat === "number" && typeof l.lng === "number")
        .map((l) => ({
          locker: l,
          distance: distanceMeters(userCoords.lat, userCoords.lng, l.lat, l.lng),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
    }

    // Fallback: first 3 by postal-code match if city looks postal-ish,
    // otherwise just the first 3.
    const cityLower = userCity.toLowerCase()
    const postalMatches = lockers.filter(
      (l) =>
        l.postalCode?.toLowerCase().includes(cityLower) ||
        l.addressLine1?.toLowerCase().includes(cityLower)
    )
    const source = postalMatches.length > 0 ? postalMatches : lockers
    return source.slice(0, 3).map((l) => ({ locker: l, distance: 0 }))
  }, [lockers, userCoords, userCity])

  const searchResults = useMemo(() => {
    if (!search.trim() || search.trim().length < 2) return []
    const q = search.toLowerCase()
    return lockers
      .filter(
        (l) =>
          l.title?.toLowerCase().includes(q) ||
          l.addressLine1?.toLowerCase().includes(q) ||
          l.postalCode?.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [lockers, search])

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
