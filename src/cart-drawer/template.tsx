"use client"

import { useEffect, useState } from "react"

import { CartDrawer } from "./cart-drawer"
import { CartDrawerHeader } from "./header"
import { CartPromoBanner } from "./promo-banner"
import { CartTieredProgress, type CartTier } from "./tiered-progress"
import { CartItem } from "./item"
import { CartFreeGift } from "./free-gift"
import { CartCrossSellCarousel, type CrossSellCarouselProduct } from "./cross-sell-carousel"
import { CartCrossSellSidebar, type CrossSellSidebarProduct } from "./cross-sell-sidebar"
import { CartGiftWrap } from "./gift-wrap"
import { CartNotes } from "./notes"
import { CartRewardsPoints } from "./rewards-points"
import { CartStickyFooter } from "./sticky-footer"
import { CartEmpty } from "./empty"
import { useCartDrawer } from "./context"

/**
 * CartDrawerTemplate — optional default assembly that composes every cart
 * drawer primitive into the mindpages-style 19-component layout. Every
 * feature is opt-in via a `CartDrawerConfig` object. Pass no config and
 * you get a minimal drawer (items + sticky footer only).
 *
 * Stores that want a different layout should NOT use this template.
 * Instead, import the primitives directly and compose their own drawer
 * body inside a `<CartDrawer>` shell. That way the store owns its
 * composition and still gets library updates to every primitive.
 *
 * Extracted from mindpages-storefront src/modules/cart-drawer/index.tsx.
 * The Bulgarian DEFAULT_CONFIG and the fake FALLBACK_PRODUCTS array were
 * removed during extraction — stores pass their own config and their own
 * cross-sell products (or none).
 */

export type CartDrawerConfig = {
  promoBanner?: {
    message: string
    variant?: "info" | "success" | "warning"
  }
  shippingTiers?: CartTier[]
  freeGift?: {
    title: string
    description?: string
    originalPrice: number
    thumbnail?: string | null
    /** Only render when the cart subtotal exceeds this amount */
    minCartTotal?: number
  }
  giftWrap?: {
    price: number
  }
  notes?: {
    types: ("gift" | "order")[]
  }
  rewards?: {
    pointsPerCurrency: number
    label?: string
    details?: string
  }
  crossSell?: {
    /** Provide your own products; pass empty array or omit to disable */
    products?: (CrossSellSidebarProduct | CrossSellCarouselProduct)[]
    /** Async loader called once the drawer has items. Return an empty array on failure. */
    loader?: () => Promise<CrossSellSidebarProduct[]>
    label?: string
  }
  showContinueShopping?: boolean
}

type CartDrawerTemplateProps = {
  config?: CartDrawerConfig
}

export function CartDrawerTemplate({
  config = {},
}: CartDrawerTemplateProps) {
  const { cart } = useCartDrawer()
  const items = cart?.items || []
  const hasItems = items.length > 0
  const currencyCode = cart?.currency_code || "eur"

  const rewardsPoints = config.rewards
    ? Math.floor(
        ((cart?.subtotal ?? 0) / 100) * config.rewards.pointsPerCurrency
      )
    : 0

  const showFreeGift =
    config.freeGift &&
    (cart?.subtotal ?? 0) >= (config.freeGift.minCartTotal ?? 0)

  // Cross-sell loader — async, only fires once the drawer has items.
  // Empty/failure state shows nothing (no fake fallback products).
  const [crossSell, setCrossSell] = useState<CrossSellSidebarProduct[]>(
    (config.crossSell?.products as CrossSellSidebarProduct[]) || []
  )
  const [crossSellLoaded, setCrossSellLoaded] = useState(
    Boolean(config.crossSell?.products)
  )

  useEffect(() => {
    if (!hasItems || crossSellLoaded) return
    const loader = config.crossSell?.loader
    if (!loader) {
      setCrossSellLoaded(true)
      return
    }
    loader()
      .then((products) => setCrossSell(products ?? []))
      .catch(() => setCrossSell([]))
      .finally(() => setCrossSellLoaded(true))
  }, [hasItems, crossSellLoaded, config.crossSell?.loader])

  return (
    <CartDrawer
      sidebar={
        hasItems && crossSell.length > 0 ? (
          <CartCrossSellSidebar products={crossSell} label={config.crossSell?.label} />
        ) : undefined
      }
    >
      <CartDrawerHeader />

      {hasItems ? (
        <>
          {config.promoBanner && (
            <CartPromoBanner
              message={config.promoBanner.message}
              variant={config.promoBanner.variant}
            />
          )}

          {config.shippingTiers && (
            <CartTieredProgress
              tiers={config.shippingTiers}
              currencyCode={currencyCode}
            />
          )}

          <div className="flex-1 overflow-y-auto no-scrollbar relative z-0 bg-card">
            {items
              .slice()
              .sort((a, b) =>
                (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
              )
              .map((item) => (
                <CartItem key={item.id} item={item} currencyCode={currencyCode} />
              ))}

            {showFreeGift && config.freeGift && (
              <CartFreeGift
                title={config.freeGift.title}
                description={config.freeGift.description}
                originalPrice={config.freeGift.originalPrice}
                currencyCode={currencyCode}
                thumbnail={config.freeGift.thumbnail}
              />
            )}

            {config.rewards && rewardsPoints > 0 && (
              <CartRewardsPoints
                points={rewardsPoints}
                label={config.rewards.label}
                details={config.rewards.details}
              />
            )}

            {config.giftWrap && (
              <CartGiftWrap
                price={config.giftWrap.price}
                currencyCode={currencyCode}
              />
            )}

            {config.notes && <CartNotes types={config.notes.types} />}

            {config.crossSell && crossSell.length > 0 && (
              <CartCrossSellCarousel
                label={config.crossSell.label}
                products={crossSell as CrossSellCarouselProduct[]}
              />
            )}
          </div>

          <CartStickyFooter />
        </>
      ) : (
        <CartEmpty />
      )}
    </CartDrawer>
  )
}
