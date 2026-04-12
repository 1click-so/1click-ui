"use client"

import * as React from "react"

import { cn } from "../lib/utils"

/**
 * SelectField — floating-label native select primitive.
 *
 * Matches `Field`'s visual treatment — the label floats into the top-left
 * when a value is selected. Uses a plain native `<select>` for simplicity
 * and native mobile keyboard support. If a fancier dropdown is needed
 * (searchable, multi-select, rich options), use the shadcn `Select`
 * primitives directly from `@1click/ui/primitives/ui/select`.
 *
 * Extracted from mindpages-storefront
 * src/modules/checkout/templates/checkout-client/index.tsx lines 207-270.
 *
 * @example
 *   <SelectField label="Country" name="country" value={country} onChange={...}>
 *     <option value="bg">Bulgaria</option>
 *     <option value="de">Germany</option>
 *   </SelectField>
 */

export type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  children: React.ReactNode
  className?: string
}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField({ label, required, disabled, children, className, value, ...props }, ref) {
    const hasValue = value !== undefined && value !== null && value !== ""

    return (
      <div className={cn("relative", className)}>
        <select
          ref={ref}
          required={required}
          disabled={disabled}
          value={value}
          className={cn(
            "w-full h-[44px] px-3 pt-[14px] pb-[2px] pr-9 text-sm rounded-lg border transition-colors duration-150 appearance-none outline-none",
            "focus:border-primary focus:bg-primary/5",
            disabled
              ? "bg-muted border-border text-muted-foreground cursor-not-allowed"
              : "bg-card border-border text-foreground hover:border-muted-foreground"
          )}
          {...props}
        >
          {children}
        </select>
        <span
          className={cn(
            "absolute pointer-events-none left-3 top-[14px] text-sm leading-4 origin-top-left",
            "transition-transform transition-colors duration-150 ease-out",
            hasValue ? "text-muted-foreground" : "text-muted-foreground",
            hasValue ? "-translate-y-2 scale-[0.77]" : "translate-y-0 scale-100"
          )}
        >
          {label}
        </span>
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    )
  }
)
