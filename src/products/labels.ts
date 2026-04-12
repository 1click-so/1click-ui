export type ProductLabels = {
  selectOption: string
  selectVariant: string
  outOfStock: string
  addToCart: string
  from: string
  original: string
  productInformation: string
  shippingAndReturns: string
  material: string
  countryOfOrigin: string
  type: string
  weight: string
  dimensions: string
  fastDelivery: string
  fastDeliveryDescription: string
  simpleExchanges: string
  simpleExchangesDescription: string
  easyReturns: string
  easyReturnsDescription: string
  relatedProducts: string
  relatedProductsDescription: string
}

export const defaultProductLabels: ProductLabels = {
  selectOption: "Select",
  selectVariant: "Select variant",
  outOfStock: "Out of stock",
  addToCart: "Add to cart",
  from: "From",
  original: "Original:",
  productInformation: "Product Information",
  shippingAndReturns: "Shipping & Returns",
  material: "Material",
  countryOfOrigin: "Country of origin",
  type: "Type",
  weight: "Weight",
  dimensions: "Dimensions",
  fastDelivery: "Fast delivery",
  fastDeliveryDescription:
    "Your package will arrive in 3-5 business days at your pick up location or in the comfort of your home.",
  simpleExchanges: "Simple exchanges",
  simpleExchangesDescription:
    "Is the fit not quite right? No worries - we'll exchange your product for a new one.",
  easyReturns: "Easy returns",
  easyReturnsDescription:
    "Just return your product and we'll refund your money. No questions asked – we'll do our best to make sure your return is hassle-free.",
  relatedProducts: "Related products",
  relatedProductsDescription:
    "You might also want to check out these products.",
}
