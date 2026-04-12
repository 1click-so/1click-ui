import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * cn — combine and de-duplicate Tailwind class names.
 *
 * Standard shadcn helper used by every component in the library. Accepts
 * strings, arrays, and conditional objects via clsx, then resolves conflicts
 * via tailwind-merge (e.g. `px-2 px-4` → `px-4`).
 *
 * @example
 *   cn("px-2 py-1", isActive && "bg-primary")
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
