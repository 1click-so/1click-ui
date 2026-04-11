"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

/**
 * Button — shadcn/ui base button primitive.
 *
 * Used as the foundation for every clickable action in the library. Accepts
 * variants via CVA. Consumers can pass `asChild` to render as any element
 * (e.g. a `<Link>`) while preserving the styles.
 *
 * Colors are driven by semantic tokens from the tailwind preset — `bg-accent`,
 * `text-accent-fg`, etc. — so a store overriding `--color-accent` repaints all
 * primary buttons without touching library code.
 */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-fg shadow hover:bg-accent/90",
        destructive:
          "bg-danger text-accent-fg shadow-sm hover:bg-danger/90",
        outline:
          "border border-border bg-surface shadow-sm hover:bg-surface-muted hover:text-text-base",
        secondary:
          "bg-surface-muted text-text-base shadow-sm hover:bg-surface-muted/80",
        ghost: "hover:bg-surface-muted hover:text-text-base",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
