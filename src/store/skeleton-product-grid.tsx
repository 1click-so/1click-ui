export function SkeletonProductGrid({
  numberOfProducts = 8,
}: {
  numberOfProducts?: number
}) {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8">
      {Array.from({ length: numberOfProducts }).map((_, i) => (
        <li key={i}>
          <div className="animate-pulse">
            <div className="aspect-[9/16] w-full bg-muted rounded-lg" />
            <div className="flex justify-between mt-4">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted rounded" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
