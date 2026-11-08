import type { AuthUser } from '../../../frontend/src/types/auth'
import type {
  Product,
  Category,
  Order,
} from '../../../frontend/src/types/product'
import type {
  Sale,
  Payment,
  CartItem,
  InventoryMovement,
  StoreSettings,
} from '../../../frontend/src/types/commerce'

// Existing JSON responses used by the integration checks. Each test checks its
// HTTP status before inspecting the corresponding response fields.
export type ApiBody = {
  user: AuthUser
  users: AuthUser[]
  product: Product
  products: Product[]
  category: Category
  categories: Category[]
  order: Order
  orders: Order[]
  sale: Sale & { orderId: string | null }
  sales: (Sale & { orderId: string | null })[]
  payment: Payment & { isDemo: boolean }
  notifications: {
    id: string
    orderId: string
    message: string
    readAt: string | null
  }[]
  items: CartItem[]
  cart: { items: CartItem[]; version: number }
  version: number
  movements: InventoryMovement[]
  settings: StoreSettings
  imageUrl: string
  paymentDemosEnabled: boolean
  database: string
  message: string
  methods: { id: string; available: boolean; isDemo: boolean }[]
}
