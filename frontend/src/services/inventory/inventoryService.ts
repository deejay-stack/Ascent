import type { AuthUser } from '../../types/auth'
import type { InventoryMovement } from '../../types/commerce'
import type { Product } from '../../types/product'
export type Adjustment = {
  productId: string
  type: 'stock-in' | 'stock-out' | 'adjustment'
  quantity: number
  reason: string
  actor: AuthUser
}
export interface InventoryService {
  list(actor: AuthUser): (Omit<Product, 'costPrice'> & { costPrice?: number })[]
  movements(actor: AuthUser): InventoryMovement[]
  adjust(input: Adjustment): Promise<void>
  updateProduct(
    id: string,
    fields: Pick<
      Product,
      'name' | 'sellingPrice' | 'costPrice' | 'lowStockThreshold' | 'isArchived' | 'isAvailable'
    >,
    actor: AuthUser,
  ): Promise<void>
}
