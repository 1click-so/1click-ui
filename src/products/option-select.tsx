"use client"

import type { HttpTypes } from "@medusajs/types"
import React from "react"
import { cn } from "../lib/utils"
import { useProductLabels } from "./context"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (optionId: string, value: string) => void
  title: string
  disabled: boolean
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  "data-testid": dataTestId,
  disabled,
}) => {
  const labels = useProductLabels()
  const filteredOptions = (option.values ?? []).map((v) => v.value)

  return (
    <div className="flex flex-col gap-y-3">
      <span className="text-sm text-foreground">
        {labels.selectOption} {title}
      </span>
      <div
        className="flex flex-wrap justify-between gap-2"
        data-testid={dataTestId}
      >
        {filteredOptions.map((v) => (
          <button
            onClick={() => updateOption(option.id, v!)}
            key={v}
            className={cn(
              "border border-border bg-muted text-sm h-10 rounded-lg p-2 flex-1",
              {
                "border-primary": v === current,
                "hover:shadow-sm transition-shadow ease-in-out duration-150":
                  v !== current,
              }
            )}
            disabled={disabled}
            data-testid="option-button"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

export { OptionSelect, type OptionSelectProps }
