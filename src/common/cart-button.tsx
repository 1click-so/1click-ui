import { retrieveCart } from "../data/cart"
import { CartButtonClient } from "./cart-button-client"

export async function CartButton() {
  const cart = await retrieveCart().catch(() => null)
  return <CartButtonClient cart={cart} />
}
