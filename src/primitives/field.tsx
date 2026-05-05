"use client"

import * as React from "react"

import { cn } from "../lib/utils"

/**
 * Field — floating-label input primitive.
 *
 * Built on a native `<input>` with a visually-overlaid label that scales up
 * when the field is empty and shrinks into the top-left corner when the
 * field is focused or has a value. This is the canonical input treatment
 * used throughout the library's checkout and any form UI.
 *
 * Why not build on shadcn's `Input`? The floating-label animation requires
 * controlling input height, padding, and label positioning together as a
 * single unit — wrapping shadcn's Input would mean overriding nearly all of
 * its styles anyway. Instead, Field is its own small primitive. Stores that
 * want plain inputs use shadcn's `Input` directly; stores that want the
 * floating-label treatment use `Field`.
 *
 * Extracted and adapted from mindpages-storefront
 * src/modules/checkout/templates/checkout-client/index.tsx lines 143-205.
 *
 * @example
 *   <Field label="Email" name="email" type="email" value={email} onChange={...} />
 */

export type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  className?: string
  /**
   * Apply the "needs filling" attention cue (3s-idle pulse). Soft blue
   * (sky-500) ring + 2-cycle pulse animation on mount, then a steady
   * highlight until the field gets a value (parent removes the prop).
   *
   * Distinct from focus (orange/primary) and error (red/destructive)
   * so the customer reads it as "this needs your attention" without
   * confusing it for an error.
   */
  pulse?: boolean
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  function Field(
    {
      label,
      required,
      disabled,
      className,
      value,
      onFocus,
      onBlur,
      pulse,
      ...props
    },
    ref
  ) {
    const [focused, setFocused] = React.useState(false)
    const hasValue = typeof value === "string" ? value.length > 0 : !!value
    const isActive = focused || hasValue

    // 2-cycle pulse on first activation. Clears after ~1.2s so the
    // animation calls attention briefly, then leaves a steady ring
    // until the customer fills the field (which removes the prop).
    const [pulsing, setPulsing] = React.useState(false)
    React.useEffect(() => {
      if (!pulse) {
        setPulsing(false)
        return
      }
      setPulsing(true)
      const t = setTimeout(() => setPulsing(false), 1200)
      return () => clearTimeout(t)
    }, [pulse])

    // Pulse only applies to empty fields without focus — once the
    // customer focuses or fills the field, the standard treatment wins.
    const showPulse = pulse && !hasValue && !focused

    return (
      <div className={cn("relative", className)}>
        <input
          ref={ref}
          required={required}
          disabled={disabled}
          value={value}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          className={cn(
            "w-full h-[44px] px-3 pt-[14px] pb-[2px] text-sm rounded-lg border",
            "transition-colors duration-300 outline-none",
            "focus:border-primary focus:bg-primary/5",
            disabled
              ? "bg-muted border-border text-muted-foreground cursor-not-allowed"
              : "bg-card border-border text-foreground hover:border-muted-foreground",
            // Attention cue: distinct soft blue. Steady ring once the
            // initial pulse settles. Wins over default border but loses
            // to focus (which is orange/primary).
            showPulse &&
              "!border-sky-500 !bg-sky-50/40 ring-2 ring-sky-400/30",
            showPulse && pulsing && "animate-pulse"
          )}
          {...props}
        />
        <span
          className={cn(
            "absolute pointer-events-none left-3 top-[14px] text-sm leading-4 origin-top-left",
            "transition-transform transition-colors duration-300 ease-out",
            showPulse ? "text-sky-600" : "text-muted-foreground",
            isActive ? "-translate-y-2 scale-[0.77]" : "translate-y-0 scale-100"
          )}
        >
          {label}
        </span>
      </div>
    )
  }
)
