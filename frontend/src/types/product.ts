export interface Product {
  id: string
  name: string
  slug: string
  description: string
  categoryId: string
  sku: string
  barcode: string
  imageUrl: string
  costPrice: number
  sellingPrice: number
  stockQuantity: number
  lowStockThreshold: number
  unit: string
  brand?: string
  isAvailable: boolean
  isFeatured: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export type CatalogProduct = Omit<Product, 'costPrice'> & { category: string; price: number; stock: number }
export interface Category { id: string; name: string }

export type OrderLine = { name: string; price: number; unit: string } & {
  productId: string
  quantity: number
  lineTotal: number
}

export type Order = {
  id: string
  userId?: string
  status: string
  fulfillment: 'Store pickup' | 'Delivery'
  createdAt: string
  items: OrderLine[]
  subtotal: number
  total: number
}
