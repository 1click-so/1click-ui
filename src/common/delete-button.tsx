"use client"

import { useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { deleteLineItem } from "../data/cart"
import { cn } from "../lib/utils"

type DeleteButtonProps = {
  id: string
  children?: React.ReactNode
  className?: string
}

export function DeleteButton({ id, children, className }: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    await deleteLineItem(id).catch(() => {
      setIsDeleting(false)
    })
  }

  return (
    <div className={cn("flex items-center justify-between text-sm", className)}>
      <button
        className="flex gap-x-1 text-text-subtle hover:text-text-base cursor-pointer"
        onClick={handleDelete}
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
        <span>{children}</span>
      </button>
    </div>
  )
}

export { type DeleteButtonProps }
