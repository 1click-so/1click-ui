import {
  bulgarianCartDrawerLabels,
  defaultCartDrawerLabels,
  type CartDrawerLabels,
} from "@1click/ui/cart-drawer"
import {
  bulgarianCheckoutLabels,
  defaultCheckoutLabels,
  type CheckoutLabels,
} from "@1click/ui/checkout"
import { convertToLocale } from "@1click/ui/lib/money"
import { cn } from "@1click/ui/lib/utils"

export default function PlaygroundPage() {
  const price = convertToLocale({ amount: 2999, currency_code: "BGN" })

  const cartLabelCount = Object.keys(bulgarianCartDrawerLabels).length
  const checkoutLabelCount = Object.keys(bulgarianCheckoutLabels).length
  const defaultCartCount = Object.keys(defaultCartDrawerLabels).length
  const defaultCheckoutCount = Object.keys(defaultCheckoutLabels).length

  return (
    <main className={cn("p-8 max-w-2xl mx-auto space-y-6")}>
      <h1 className="text-2xl font-bold text-text-base">
        1click-ui playground
      </h1>

      <section className="bg-surface border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-text-base">Imports OK</h2>
        <ul className="text-sm text-text-muted space-y-1">
          <li>convertToLocale: {price}</li>
          <li>cn: {cn("a", false && "b", "c")}</li>
          <li>BG cart labels: {cartLabelCount} keys</li>
          <li>BG checkout labels: {checkoutLabelCount} keys</li>
          <li>EN cart labels: {defaultCartCount} keys</li>
          <li>EN checkout labels: {defaultCheckoutCount} keys</li>
        </ul>
      </section>

      <section className="bg-surface-muted border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-text-base">Token check</h2>
        <div className="mt-3 flex gap-3">
          <div className="w-12 h-12 rounded bg-accent" title="accent" />
          <div className="w-12 h-12 rounded bg-success" title="success" />
          <div className="w-12 h-12 rounded bg-warning" title="warning" />
          <div className="w-12 h-12 rounded bg-danger" title="danger" />
        </div>
        <p className="mt-3 text-text-subtle text-xs">
          If the squares above have color, semantic tokens resolve correctly.
        </p>
      </section>
    </main>
  )
}
