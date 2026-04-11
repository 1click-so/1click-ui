"use client"

import { useEffect, useRef, type ReactNode } from "react"

import { cn } from "../lib/utils"
import { useCartDrawer } from "./context"

/**
 * Slide-out cart drawer shell. Contains an overlay, a focus-trapped panel
 * that slides in from the right, an optional left sidebar (desktop only)
 * for cross-sell, and a main content slot for the drawer body.
 *
 * Visual 1:1 with mindpages but colors are token-driven: `bg-surface`,
 * `bg-surface-muted`, `border-border`. Override by setting CSS variables
 * on the consuming store's :root.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/cart-drawer.tsx.
 */

type CartDrawerProps = {
  sidebar?: ReactNode
  children: ReactNode
  /** Optional className for the main panel (composes with internal styles) */
  panelClassName?: string
}

export function CartDrawer({ sidebar, children, panelClassName }: CartDrawerProps) {
  const { isOpen, close } = useCartDrawer()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus()
    }
  }, [isOpen])

  const hasSidebar = !!sidebar

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 transition-opacity duration-300 z-[60]",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={cn(
          "fixed top-0 right-0 h-full bg-surface z-[61] flex overflow-hidden",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isOpen ? "translate-x-0" : "translate-x-full",
          hasSidebar ? "w-full md:w-[740px]" : "w-full sm:w-[460px]",
          panelClassName
        )}
        style={{
          boxShadow: isOpen ? "-20px 0 60px rgba(0,0,0,0.12)" : "none",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        {/* Sidebar — desktop only */}
        {hasSidebar && (
          <div className="hidden md:block w-[280px] flex-shrink-0 bg-surface-muted border-r border-border">
            {sidebar}
          </div>
        )}

        {/* Main cart */}
        <div className="flex-1 flex flex-col min-w-0 bg-surface">{children}</div>
      </div>
    </>
  )
}
