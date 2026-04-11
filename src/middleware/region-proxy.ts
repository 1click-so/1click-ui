import type { HttpTypes } from "@medusajs/types"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Region-detection middleware — wraps the store URL under a country-code
 * path segment (e.g. `/bg/products/...`), caches a region map from the
 * Medusa backend, and redirects bare visits to the best region.
 *
 * Extracted from mindpages-storefront src/proxy.ts. Stores consume it
 * from their own top-level middleware like this:
 *
 *   // middleware.ts in the store repo
 *   export { proxy as middleware, config } from "@1click/ui/middleware/region-proxy"
 *
 * Or, if the store wants to add its own logic, wrap it:
 *
 *   import { proxy as regionProxy, config as regionConfig } from "@1click/ui/middleware/region-proxy"
 *
 *   export async function middleware(request: NextRequest) {
 *     const response = await regionProxy(request)
 *     // ... custom logic ...
 *     return response
 *   }
 *   export const config = regionConfig
 *
 * Required env:
 *   - MEDUSA_BACKEND_URL
 *   - NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
 *   - NEXT_PUBLIC_DEFAULT_REGION (optional, defaults to "us")
 */

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

async function getRegionMap(
  cacheId: string
): Promise<Map<string, HttpTypes.StoreRegion>> {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (!BACKEND_URL) {
    throw new Error(
      "region-proxy: MEDUSA_BACKEND_URL is not set. Make sure the env var is configured in the consuming store's environment."
    )
  }

  if (
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - 3600 * 1000
  ) {
    // Next.js extends native fetch with `next: { revalidate, tags }` at
    // runtime, but the ambient RequestInit type doesn't include it. Cast
    // avoids the type error without losing correctness.
    const fetchInit = {
      headers: { "x-publishable-api-key": PUBLISHABLE_API_KEY! },
      next: { revalidate: 3600, tags: [`regions-${cacheId}`] },
      cache: "force-cache" as RequestCache,
    } as RequestInit
    const { regions } = await fetch(`${BACKEND_URL}/store/regions`, fetchInit).then(async (response) => {
      const json = await response.json()
      if (!response.ok) throw new Error(json.message)
      return json
    })

    if (!regions?.length) {
      throw new Error(
        "No regions found. Please set up regions in your Medusa Admin."
      )
    }

    regions.forEach((region: HttpTypes.StoreRegion) => {
      region.countries?.forEach((c) => {
        regionMapCache.regionMap.set(c.iso_2 ?? "", region)
      })
    })

    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
): Promise<string | undefined> {
  try {
    let countryCode: string | undefined

    const vercelCountryCode = request.headers
      .get("x-vercel-ip-country")
      ?.toLowerCase()

    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else {
      const first = regionMap.keys().next().value
      countryCode = typeof first === "string" ? first : undefined
    }

    return countryCode
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "region-proxy: Error getting the country code. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable?"
      )
    }
    return undefined
  }
}

/**
 * Proxy entry point — run on every request except assets. Redirects to a
 * country-code URL if one isn't already present, seeds the region cache
 * cookie, and otherwise passes through.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  let redirectUrl = request.nextUrl.href
  let response = NextResponse.redirect(redirectUrl, 307)

  const cacheIdCookie = request.cookies.get("_medusa_cache_id")
  const cacheId = cacheIdCookie?.value || crypto.randomUUID()

  const regionMap = await getRegionMap(cacheId)
  const countryCode = regionMap && (await getCountryCode(request, regionMap))

  const urlHasCountryCode = Boolean(
    countryCode && request.nextUrl.pathname.split("/")[1]?.includes(countryCode)
  )

  if (urlHasCountryCode && cacheIdCookie) {
    return NextResponse.next()
  }

  if (urlHasCountryCode && !cacheIdCookie) {
    response.cookies.set("_medusa_cache_id", cacheId, { maxAge: 60 * 60 * 24 })
    return response
  }

  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  const redirectPath =
    request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname
  const queryString = request.nextUrl.search ? request.nextUrl.search : ""

  if (!urlHasCountryCode && countryCode) {
    redirectUrl = `${request.nextUrl.origin}/${countryCode}${redirectPath}${queryString}`
    response = NextResponse.redirect(redirectUrl, 307)
  } else if (!urlHasCountryCode && !countryCode) {
    return new NextResponse(
      "No valid regions configured. Please set up regions with countries in your Medusa Admin.",
      { status: 500 }
    ) as unknown as NextResponse
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
