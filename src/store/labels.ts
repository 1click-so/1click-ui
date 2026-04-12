export type StoreLabels = {
  allProducts: string
  sortBy: string
  latestArrivals: string
  priceLowToHigh: string
  priceHighToLow: string
}

export const defaultStoreLabels: StoreLabels = {
  allProducts: "All products",
  sortBy: "Sort by",
  latestArrivals: "Latest Arrivals",
  priceLowToHigh: "Price: Low → High",
  priceHighToLow: "Price: High → Low",
}
