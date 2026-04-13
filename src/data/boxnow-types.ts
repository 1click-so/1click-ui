/**
 * BoxNow data types — in a separate file from boxnow.ts because the
 * latter is "use server" (must only export async functions). Client
 * components import types from here; server action from boxnow.ts.
 */

export type BoxNowLocker = {
  id: string
  title: string
  addressLine1: string
  addressLine2?: string | null
  postalCode: string
  country?: string | null
  lat: number
  lng: number
  note?: string | null
}

export type ListBoxNowLockersResult =
  | { ok: true; lockers: BoxNowLocker[] }
  | { ok: false; reason: "unconfigured" | "upstream" | "network" }
