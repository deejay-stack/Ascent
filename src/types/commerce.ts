import type { Category, Order, Product } from './product'
import type { AuthUser } from './auth'

export type CartItem = { productId: string; quantity: number }
export type PaymentMethod = 'cash' | 'gcash' | 'maya' | 'card'
export type SaleItem = { productId: string; name: string; categoryId: string; unit: string; imageUrl: string; quantity: number; unitPrice: number; total: number }
export type Totals = { subtotal: number; discount: number; tax: number; total: number }
export type Sale = Totals & {
  storeName: string; storeAddress: string
  id: string; receiptNumber: string; createdAt: string; cashier: string; cashierId: string
  source: 'pos' | 'online'; items: SaleItem[]; paymentMethod: PaymentMethod
  amountReceived: number; change: number; paymentId: string
}
export type InventoryMovement = {
  id: string; productId: string; productName: string; type: 'sale' | 'stock-in' | 'stock-out' | 'adjustment' | 'order'
  quantity: number; before: number; after: number; reason: string; responsibleUser: string; createdAt: string; reference?: string
}
export type Payment = { id: string; transactionId: string; method: PaymentMethod; total: number; status: 'pending' | 'succeeded' | 'failed' | 'cancelled' }
export type StoreSettings = { name: string; address: string; taxRate: number }
export type MockState = {
  version: 1; products: Product[]; categories: Category[]; sales: Sale[]; movements: InventoryMovement[]; orders: Order[]; settings: StoreSettings
}
export type SaleRequest = { transactionId: string; items: CartItem[]; discount: number; taxRate: number; paymentMethod: PaymentMethod; amountReceived: number; paymentId?: string; actor: AuthUser }
