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
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  function Field(
    { label, required, disabled, className, value, onFocus, onBlur, ...props },
    ref
  ) {
    const [focused, setFocused] = React.useState(false)
    const hasValue = typeof value === "string" ? value.length > 0 : !!value
    const isActive = focused || hasValue

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
            "transition-colors duration-150 outline-none",
            "focus:border-accent focus:bg-accent/5",
            disabled
              ? "bg-surface-muted border-border text-text-subtle cursor-not-allowed"
              : "bg-surface border-border text-text-base hover:border-text-subtle"
          )}
          {...props}
        />
        <span
          className={cn(
            "absolute pointer-events-none left-3 top-[14px] text-sm leading-4 origin-top-left",
            "transition-transform transition-colors duration-150 ease-out",
            isActive ? "text-text-muted" : "text-text-subtle",
            isActive ? "-translate-y-2 scale-[0.77]" : "translate-y-0 scale-100"
          )}
        >
          {label}
        </span>
      </div>
    )
  }
)
