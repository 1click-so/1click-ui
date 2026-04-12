"use client"

import { useState, type ChangeEvent } from "react"

import { Field } from "../primitives/field"
import { cn } from "../lib/utils"
import { useCheckoutLabels } from "./context"

/**
 * CompanyDetails — collapsible "Company invoice" section shown under the
 * address form. Four fields: name, VAT, MOL (responsible person), address.
 *
 * ⚠️ NOTE: as of 2026-04-11 the backend does not have first-class storage
 * for these fields. See KNOWN_ISSUES.md "Company invoice fields silently
 * dropped during checkout". This component renders the UI, but the
 * values are only wired into cart metadata. A backend fix is tracked
 * separately.
 *
 * Extracted from mindpages-storefront
 * src/modules/checkout/templates/checkout-client/index.tsx lines 276-349.
 */

type CompanyDetailsProps = {
  formData: Record<string, string>
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
}

export function CompanyDetails({ formData, onChange, onBlur }: CompanyDetailsProps) {
  const labels = useCheckoutLabels()
  const [open, setOpen] = useState(!!formData.company_name?.trim())

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            open && "rotate-90"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
          />
        </svg>
        {labels.companyInvoice}
      </button>

      {open && (
        <div className="mt-3 space-y-2.5">
          <Field
            label={labels.companyName}
            name="company_name"
            value={formData.company_name ?? ""}
            onChange={onChange}
            onBlur={onBlur}
          />
          <Field
            label={labels.companyVat}
            name="company_vat"
            value={formData.company_vat ?? ""}
            onChange={onChange}
            onBlur={onBlur}
          />
          <Field
            label={labels.companyMol}
            name="company_mol"
            value={formData.company_mol ?? ""}
            onChange={onChange}
            onBlur={onBlur}
          />
          <Field
            label={labels.companyAddress}
            name="company_address"
            value={formData.company_address ?? ""}
            onChange={onChange}
            onBlur={onBlur}
          />
        </div>
      )}
    </div>
  )
}
