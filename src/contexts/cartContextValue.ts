import { createContext } from 'react'

export type CartLine = {
  productId: string
  quantity: number
}

export type CartContextValue = {
  items: CartLine[]
  itemCount: number
  addItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
}

export const CartContext = createContext<CartContextValue | null>(null)
