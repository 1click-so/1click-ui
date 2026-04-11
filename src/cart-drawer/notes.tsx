"use client"

import { useState } from "react"

import { cn } from "../lib/utils"
import { useCartDrawer } from "./context"

/**
 * CartNotes — pill buttons to open gift/order note textareas.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-notes.tsx.
 * Tokens applied. Icons + placeholders pulled from `labels` context.
 */

type NoteType = "gift" | "order"

type CartNotesProps = {
  types?: NoteType[]
  onSave?: (type: NoteType, value: string) => void
}

const iconGift = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1.5" y="5" width="11" height="7.5" rx="1" />
    <rect x="0.5" y="3" width="13" height="2.5" rx="0.5" />
    <path d="M7 3v9.5" />
  </svg>
)

const iconOrder = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8.5 1.5H4a1 1 0 00-1 1v9a1 1 0 001 1h6a1 1 0 001-1V4L8.5 1.5z" />
    <path d="M8.5 1.5V4H11M5.5 7h3M5.5 9.5h3" />
  </svg>
)

export function CartNotes({
  types = ["gift", "order"],
  onSave,
}: CartNotesProps) {
  const { labels } = useCartDrawer()
  const [activeNote, setActiveNote] = useState<NoteType | null>(null)
  const [values, setValues] = useState<Record<NoteType, string>>({
    gift: "",
    order: "",
  })

  const noteConfig: Record<
    NoteType,
    { label: string; placeholder: string; icon: React.ReactNode }
  > = {
    gift: {
      label: labels.giftNote,
      placeholder: labels.giftNotePlaceholder,
      icon: iconGift,
    },
    order: {
      label: labels.orderNote,
      placeholder: labels.orderNotePlaceholder,
      icon: iconOrder,
    },
  }

  return (
    <div className="px-5 sm:px-6 py-3">
      <div className="flex gap-2">
        {types.map((type) => {
          const config = noteConfig[type]
          const active = activeNote === type
          return (
            <button
              key={type}
              type="button"
              onClick={() => setActiveNote(active ? null : type)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 min-h-[44px] rounded-xl border transition-colors active:scale-[0.97]",
                active
                  ? "border-text-base bg-text-base text-surface"
                  : "border-border text-text-muted hover:border-text-muted active:bg-surface-muted"
              )}
            >
              {config.icon}
              {config.label}
            </button>
          )
        })}
      </div>

      {activeNote && (
        <div className="mt-3">
          <textarea
            value={values[activeNote]}
            onChange={(e) =>
              setValues({ ...values, [activeNote]: e.target.value })
            }
            onBlur={() => onSave?.(activeNote, values[activeNote])}
            placeholder={noteConfig[activeNote].placeholder}
            rows={3}
            className="w-full text-[14px] sm:text-sm border border-border rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent placeholder:text-text-subtle text-text-base bg-surface"
          />
        </div>
      )}
    </div>
  )
}
