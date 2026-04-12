"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "../lib/utils"

export function Pagination({
  page,
  totalPages,
  "data-testid": dataTestid,
}: {
  page: number
  totalPages: number
  "data-testid"?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const arrayRange = (start: number, stop: number) =>
    Array.from({ length: stop - start + 1 }, (_, index) => start + index)

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams)
    params.set("page", newPage.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  const renderPageButton = (
    p: number,
    label: string | number,
    isCurrent: boolean
  ) => (
    <button
      key={p}
      className={cn("text-xl text-muted-foreground", {
        "text-foreground font-semibold": isCurrent,
        "hover:text-muted-foreground": !isCurrent,
      })}
      disabled={isCurrent}
      onClick={() => handlePageChange(p)}
    >
      {label}
    </button>
  )

  const renderEllipsis = (key: string) => (
    <span key={key} className="text-xl text-muted-foreground cursor-default">
      ...
    </span>
  )

  const renderPageButtons = () => {
    const buttons: React.ReactNode[] = []

    if (totalPages <= 7) {
      buttons.push(
        ...arrayRange(1, totalPages).map((p) =>
          renderPageButton(p, p, p === page)
        )
      )
    } else if (page <= 4) {
      buttons.push(
        ...arrayRange(1, 5).map((p) => renderPageButton(p, p, p === page))
      )
      buttons.push(renderEllipsis("e1"))
      buttons.push(renderPageButton(totalPages, totalPages, false))
    } else if (page >= totalPages - 3) {
      buttons.push(renderPageButton(1, 1, false))
      buttons.push(renderEllipsis("e2"))
      buttons.push(
        ...arrayRange(totalPages - 4, totalPages).map((p) =>
          renderPageButton(p, p, p === page)
        )
      )
    } else {
      buttons.push(renderPageButton(1, 1, false))
      buttons.push(renderEllipsis("e3"))
      buttons.push(
        ...arrayRange(page - 1, page + 1).map((p) =>
          renderPageButton(p, p, p === page)
        )
      )
      buttons.push(renderEllipsis("e4"))
      buttons.push(renderPageButton(totalPages, totalPages, false))
    }

    return buttons
  }

  return (
    <div className="flex justify-center w-full mt-12">
      <div className="flex gap-3 items-end" data-testid={dataTestid}>
        {renderPageButtons()}
      </div>
    </div>
  )
}
