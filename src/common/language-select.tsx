"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateLocale } from "../data/locale-actions"
import type { Locale } from "../data/locales"

type LanguageSelectProps = {
  locales: Locale[]
  currentLocale: string | null
  className?: string
}

export function LanguageSelect({
  locales,
  currentLocale,
  className,
}: LanguageSelectProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value
    startTransition(async () => {
      await updateLocale(code)
      router.refresh()
    })
  }

  return (
    <select
      value={currentLocale || ""}
      onChange={handleChange}
      disabled={isPending}
      className={
        className ??
        "text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2 disabled:opacity-50"
      }
    >
      {locales.map((locale) => (
        <option key={locale.code} value={locale.code}>
          {locale.name}
        </option>
      ))}
    </select>
  )
}

export { type LanguageSelectProps }
