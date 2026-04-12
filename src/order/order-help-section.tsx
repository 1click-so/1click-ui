import { MessageSquare, Undo2 } from "lucide-react"
import LocalizedLink from "../common/localized-link"
import { defaultOrderLabels, type OrderLabels } from "./labels"

type OrderHelpSectionProps = {
  labels?: Pick<OrderLabels, "needHelp" | "contactUs" | "returnsExchanges">
  contactHref?: string
  returnsHref?: string
}

export function OrderHelpSection({
  labels,
  contactHref = "/contact",
  returnsHref = "/contact",
}: OrderHelpSectionProps) {
  const l = { ...defaultOrderLabels, ...labels }

  return (
    <div className="bg-surface rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-text-base mb-3">
        {l.needHelp}
      </h3>
      <div className="flex flex-col gap-2">
        <LocalizedLink
          href={contactHref}
          className="flex items-center gap-2.5 text-sm text-text-muted hover:text-text-base transition-colors py-1"
        >
          <MessageSquare className="w-4 h-4" />
          {l.contactUs}
        </LocalizedLink>
        <LocalizedLink
          href={returnsHref}
          className="flex items-center gap-2.5 text-sm text-text-muted hover:text-text-base transition-colors py-1"
        >
          <Undo2 className="w-4 h-4" />
          {l.returnsExchanges}
        </LocalizedLink>
      </div>
    </div>
  )
}

export { type OrderHelpSectionProps }
