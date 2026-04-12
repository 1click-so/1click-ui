import { cn } from "../lib/utils"

type SkeletonProps = {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded bg-surface-muted", className)}
    />
  )
}

export function SkeletonProductPreview() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[9/16] w-full bg-surface-muted rounded-lg" />
      <div className="flex justify-between mt-2">
        <div className="w-2/5 h-6 bg-surface-muted rounded" />
        <div className="w-1/5 h-6 bg-surface-muted rounded" />
      </div>
    </div>
  )
}
