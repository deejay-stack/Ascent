import { categories, seedProducts } from '../data/grocerySeed'
import type { AuthUser } from '../types/auth'
import type { MockState, CartItem } from '../types/commerce'
import type { CatalogProduct } from '../types/product'
import { mockStorage } from './storage/mockStorage'
import { resolveProductImage } from './productImages'

const key = 'ascent-commerce-v1'
const initial: MockState = {
  version: 1,
  products: seedProducts,
  categories,
  sales: [],
  movements: [],
  orders: [],
  settings: {
    name: 'ASCENT',
    address: 'Store address · Your barangay, city, Philippines',
    taxRate: 0,
  },
}
const saved = mockStorage.read<MockState | null>(key, null)
let state: MockState =
  saved?.version === 1 &&
  Array.isArray(saved.products) &&
  Array.isArray(saved.sales) &&
  Array.isArray(saved.movements) &&
  Array.isArray(saved.orders) &&
  saved.settings
    ? saved
    : structuredClone(initial)
const listeners = new Set<() => void>()
state.categories ??= structuredClone(categories)
function refreshProductImages(snapshot: MockState) {
  snapshot.products = snapshot.products.map((product) => ({
    ...product,
    imageUrl: resolveProductImage(product.imageUrl),
  }))
}
refreshProductImages(state)
export const getState = () => state
export const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
export function requireOperator(actor: AuthUser) {
  if (!actor || !['owner', 'staff'].includes(actor.role))
    throw new Error('An owner or staff account is required.')
}
export function mutate<T>(operation: (draft: MockState) => T): T {
  const draft = structuredClone(state)
  const result = operation(draft)
  mockStorage.write(key, draft)
  state = draft
  listeners.forEach((listener) => listener())
  return result
}
export function validateCart(draft: MockState, items: CartItem[]) {
  if (!items.length) throw new Error('Add at least one product.')
  const combined = new Map<string, number>()
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1)
      throw new Error('Quantity must be a positive whole number.')
    combined.set(item.productId, (combined.get(item.productId) ?? 0) + item.quantity)
  }
  return [...combined].map(([productId, quantity]) => {
    const product = draft.products.find((p) => p.id === productId)
    if (!product || product.isArchived || !product.isAvailable)
      throw new Error('A product is no longer available.')
    if (quantity > product.stockQuantity)
      throw new Error(`${product.name}: only ${product.stockQuantity} in stock.`)
    return { product, quantity }
  })
}
export function projectCatalog(): CatalogProduct[] {
  return state.products
    .filter((p) => !p.isArchived)
    .map((p) => {
      const { costPrice, ...publicFields } = p
      void costPrice
      return {
        ...publicFields,
        category: state.categories.find((c) => c.id === p.categoryId)?.name ?? p.categoryId,
        price: p.sellingPrice,
        stock: p.stockQuantity,
      }
    })
}
let revision = 0
subscribe(() => {
  revision += 1
})
export const getRevision = () => revision
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key !== key || !event.newValue) return
    const next = mockStorage.read<MockState | null>(key, null)
    if (
      next?.version === 1 &&
      Array.isArray(next.products) &&
      Array.isArray(next.sales) &&
      Array.isArray(next.movements) &&
      Array.isArray(next.orders) &&
      next.settings
    ) {
      state = { ...next, categories: next.categories ?? structuredClone(categories) }
      refreshProductImages(state)
      listeners.forEach((listener) => listener())
    }
  })
