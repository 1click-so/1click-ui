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
 * ConsentBanner — blocking consent MODAL (Consent Mode v2 UI).
 *
 * Deliberately NOT a dismissible bottom bar (per merchant decision
 * 2026-07-18: bars get ignored, and an ignored banner = permanently
 * denied consent = the visitor never enters ad audiences). This is a
 * centered modal over a dark backdrop, body scroll locked, no
 * click-outside dismiss and no X — the only exits are a consent
 * choice. Shown once per stored choice (12-month cookie), so the
 * interruption is a one-time cost per visitor.
 *
 * Layer 1: short text + "Приемам" (primary) + "Настройки" (ghost).
 * A first-layer reject renders only when `rejectOnFirstLayer` is true —
 * default follows the prevailing EU e-commerce pattern where declining
 * lives one layer deeper. The settings layer ALWAYS carries functional
 * "Откажи всички" — reject exists and is reachable (not a cookie
 * wall), which is what keeps the pattern defensible.
 *
 * Layer 2: purpose toggles + "Запази избора" + "Приемам всички" +
 * "Откажи всички". Re-openable any time via `openConsentSettings()`
 * (see <ConsentSettingsLink>) so consent can be changed/withdrawn.
 *
 * The synchronous consent DEFAULT is <ConsentInit>'s job — this
 * component only collects the choice and applies the live update.
 *
 * z-[70]: above the cart drawer (z-[60]) — a blocking modal that can
 * be covered isn't blocking. In practice it shows on first landing,
 * before any drawer interaction.
 */
export function ConsentBanner({
  privacyHref = "/cookies",
  rejectOnFirstLayer = false,
}: {
  /** Where "Виж повече" points — the store's cookie/privacy page. */
  privacyHref?: string
  /** Render a visible "Откажи" on layer 1 (strict-compliance mode). */
  rejectOnFirstLayer?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [ads, setAds] = useState(true)

  // First render decides visibility from the cookie — in an effect, not
  // during render, so SSR HTML never includes the modal (no hydration
  // mismatch, no flash for already-consented visitors).
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

  // Body scroll lock while the modal blocks the page.
  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [visible])

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
      aria-modal="true"
      aria-label="Настройки за бисквитки"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
    >
      <div className="w-full rounded-t-2xl bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-8">
        {!settingsOpen ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold text-foreground">
                Преди да продължиш
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Използваме бисквитки, за да работи магазинът и да показваме
                по-подходящи предложения за теб.{" "}
                <a
                  href={privacyHref}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Виж повече
                </a>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => decide({ analytics: true, ads: true })}
                className="h-12 w-full rounded-md bg-foreground text-sm font-bold uppercase tracking-[0.02em] text-card transition-colors hover:bg-foreground/90"
              >
                Приемам
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="h-12 w-full rounded-md border border-border text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Настройки
              </button>
              {rejectOnFirstLayer ? (
                <button
                  type="button"
                  onClick={() => decide({ analytics: false, ads: false })}
                  className="h-10 w-full rounded-md text-[13px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Откажи
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-lg font-semibold text-foreground">
              Настройки за бисквитки
            </p>

            <div className="flex flex-col gap-4">
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
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => decide({ analytics: true, ads: true })}
                className="h-12 w-full rounded-md bg-foreground text-sm font-bold uppercase tracking-[0.02em] text-card transition-colors hover:bg-foreground/90"
              >
                Приемам всички
              </button>
              <button
                type="button"
                onClick={() => decide({ analytics, ads })}
                className="h-12 w-full rounded-md border border-border text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Запази избора
              </button>
              <button
                type="button"
                onClick={() => decide({ analytics: false, ads: false })}
                className="h-10 w-full rounded-md text-[13px] font-medium text-muted-foreground hover:text-foreground"
              >
                Откажи всички
              </button>
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
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="block text-[13px] leading-relaxed text-muted-foreground">
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
 * ConsentSettingsLink — drop-in footer link that re-opens the modal on
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
