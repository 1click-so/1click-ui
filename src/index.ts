// @1click/ui — main entry
//
// Re-exports the most commonly used pieces from the library. Stores can
// import either from the top-level entry (this file) or from subpaths
// (e.g. `@1click/ui/primitives/ui/button`) for tree-shaking.

// ── Utilities ──────────────────────────────────────────────────────────
export { cn } from "./lib/utils"
export {
  convertToLocale,
  noDivisionCurrencies,
  type ConvertToLocaleParams,
} from "./lib/money"
export { default as medusaError } from "./lib/medusa-error"
export { isStripeLike, isPaypal, isManual } from "./lib/payment-constants"
export { DualPrice, EUR_TO_BGN_RATE, type DualPriceProps } from "./lib/dual-price"

// ── Floating-label form primitives ─────────────────────────────────────
export { Field, type FieldProps } from "./primitives/field"
export { SelectField, type SelectFieldProps } from "./primitives/select-field"

// ── shadcn/Radix base primitives ───────────────────────────────────────
// Re-exported at top level for convenience. Also importable via subpaths
// (`@1click/ui/primitives/ui/button`, etc.) if a store wants to minimize
// its import surface.
export { Button, buttonVariants, type ButtonProps } from "./primitives/ui/button"
export { Input } from "./primitives/ui/input"
export { Label } from "./primitives/ui/label"
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from "./primitives/ui/select"
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./primitives/ui/dialog"
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./primitives/ui/sheet"
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./primitives/ui/tabs"
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./primitives/ui/accordion"
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./primitives/ui/collapsible"
export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent } from "./primitives/ui/popover"
