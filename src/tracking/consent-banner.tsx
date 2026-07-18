"use client"

import { useCallback, useEffect, useState } from "react"

import {
  CONSENT_OPEN_EVENT,
  applyConsent,
  openConsentSettings,
  readConsentCookie,
  writeConsentCookie,
  type ConsentChoices,
} from "./consent"

/**
 * ConsentBanner — the two-layer cookie-consent UI.
 *
 * Layer 1 (bottom bar): short text + "Приемам" (primary) + "Настройки".
 * A first-layer reject is rendered only when `rejectOnFirstLayer` is
 * true — the default follows the prevailing EU e-commerce pattern where
 * declining lives one layer deeper. Flipping the flag is the store's
 * one-line answer to a stricter enforcement climate; the settings layer
 * ALWAYS carries a functional "Откажи всички", which is what keeps the
 * default pattern defensible (reject exists and is reachable — it is
 * not a cookie wall).
 *
 * Layer 2 (settings): purpose toggles + "Запази избора" + "Приемам
 * всички" + "Откажи всички". Re-openable any time via
 * `openConsentSettings()` (see <ConsentSettingsLink>) so consent can be
 * changed/withdrawn after the fact.
 *
 * The banner renders only when no stored choice exists (or when
 * re-opened). The synchronous consent DEFAULT is <ConsentInit>'s job —
 * this component only collects the choice and applies the update.
 *
 * Mounted AFTER interactive content in the layout body; fixed to the
 * bottom at z-50 — deliberately BELOW the cart drawer (z-[60]) so a
 * shopper mid-checkout-flow is never blocked by the banner.
 */
export function ConsentBanner({
  privacyHref = "/cookies",
  rejectOnFirstLayer = false,
}: {
  /** Where "Виж повече" points — the store's cookie/privacy page. */
  privacyHref?: string
  /** Render "Откажи" on the first layer (strict-compliance mode). */
  rejectOnFirstLayer?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [ads, setAds] = useState(true)

  // First render decides visibility from the cookie — in an effect, not
  // during render, so SSR HTML never includes the banner (no hydration
  // mismatch, no layout flash for consented visitors).
  useEffect(() => {
    const stored = readConsentCookie()
    if (!stored) {
      setVisible(true)
    } else {
      setAnalytics(stored.analytics)
      setAds(stored.ads)
    }
  }, [])

  // Footer "Настройки на бисквитките" link → re-open on settings layer
  // with the stored choice pre-loaded.
  useEffect(() => {
    const onOpen = () => {
      const stored = readConsentCookie()
      if (stored) {
        setAnalytics(stored.analytics)
        setAds(stored.ads)
      }
      setSettingsOpen(true)
      setVisible(true)
    }
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen)
  }, [])

  const decide = useCallback((choices: Omit<ConsentChoices, "ts">) => {
    const full: ConsentChoices = { ...choices, ts: Date.now() }
    writeConsentCookie(full)
    applyConsent(full)
    setVisible(false)
    setSettingsOpen(false)
  }, [])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Настройки за бисквитки"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto max-w-3xl rounded-md border border-border bg-card p-4 shadow-lg sm:p-5">
        {!settingsOpen ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <p className="flex-1 text-[13px] leading-relaxed text-muted-foreground">
              Използваме бисквитки, за да работи магазинът и да показваме
              по-подходящи предложения.{" "}
              <a
                href={privacyHref}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Виж повече
              </a>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {rejectOnFirstLayer ? (
                <button
                  type="button"
                  onClick={() => decide({ analytics: false, ads: false })}
                  className="h-10 rounded-md px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Откажи
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="h-10 rounded-md border border-border px-4 text-[13px] font-medium text-foreground hover:bg-muted"
              >
                Настройки
              </button>
              <button
                type="button"
                onClick={() => decide({ analytics: true, ads: true })}
                className="h-10 rounded-md bg-foreground px-5 text-[13px] font-bold text-card hover:bg-foreground/90"
              >
                Приемам
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-foreground">
              Настройки за бисквитки
            </p>

            <ConsentRow
              label="Задължителни"
              description="Количка, поръчка, сигурност. Винаги активни."
              checked
              disabled
            />
            <ConsentRow
              label="Анализ и подобрения"
              description="Помагат ни да разбираме как се използва магазинът."
              checked={analytics}
              onChange={setAnalytics}
            />
            <ConsentRow
              label="Реклама и персонализация"
              description="По-подходящи предложения в Google и социалните мрежи."
              checked={ads}
              onChange={setAds}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => decide({ analytics: false, ads: false })}
                className="text-left text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Откажи всички
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => decide({ analytics, ads })}
                  className="h-10 rounded-md border border-border px-4 text-[13px] font-medium text-foreground hover:bg-muted"
                >
                  Запази избора
                </button>
                <button
                  type="button"
                  onClick={() => decide({ analytics: true, ads: true })}
                  className="h-10 rounded-md bg-foreground px-5 text-[13px] font-bold text-card hover:bg-foreground/90"
                >
                  Приемам всички
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ConsentRow({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange?: (next: boolean) => void
}) {
  return (
    <label
      className={`flex items-start justify-between gap-4 ${
        disabled ? "" : "cursor-pointer"
      }`}
    >
      <span className="flex-1">
        <span className="block text-[13px] font-medium text-foreground">
          {label}
        </span>
        <span className="block text-[12px] leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-foreground"
      />
    </label>
  )
}

/**
 * ConsentSettingsLink — drop-in footer link that re-opens the banner on
 * its settings layer ("withdraw consent as easily as it was given").
 */
export function ConsentSettingsLink({
  children = "Настройки на бисквитките",
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <button type="button" onClick={openConsentSettings} className={className}>
      {children}
    </button>
  )
}
