import type { Product } from '../../types/product'
import type { AuthUser } from '../../types/auth'
import { cents } from '../money'
import { id, mutate } from '../mockStore'

export type ProductInput = Omit<Product, 'id' | 'slug' | 'createdAt' | 'updatedAt'>
export const productManagementService = {
  async save(productId: string | null, input: ProductInput, actor: AuthUser) {
    if (actor.role !== 'owner') throw new Error('Only owners can manage products.')
    if (!input.name.trim() || !input.description.trim() || !input.unit.trim())
      throw new Error('Name, description and unit are required.')
    if (!/^[A-Z0-9-]{3,40}$/i.test(input.sku))
      throw new Error('SKU must contain 3–40 letters, numbers or hyphens.')
    if (!/^\d{8,14}$/.test(input.barcode)) throw new Error('Barcode must contain 8–14 digits.')
    cents(input.sellingPrice)
    cents(input.costPrice)
    if (
      !Number.isSafeInteger(input.stockQuantity) ||
      input.stockQuantity < 0 ||
      !Number.isSafeInteger(input.lowStockThreshold) ||
      input.lowStockThreshold < 0
    )
      throw new Error('Stock and threshold must be non-negative whole numbers.')
    if (!/^(\/images\/|https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(input.imageUrl))
      throw new Error('Choose a local image or a valid HTTPS image URL.')
    return mutate((draft) => {
      if (!draft.categories.some((c) => c.id === input.categoryId))
        throw new Error('Choose an existing category.')
      if (
        draft.products.some(
          (p) =>
            p.id !== productId &&
            (p.sku.toLowerCase() === input.sku.toLowerCase() || p.barcode === input.barcode),
        )
      )
        throw new Error('SKU and barcode must be unique.')
      const now = new Date().toISOString()
      if (productId) {
        const p = draft.products.find((p) => p.id === productId)
        if (!p) throw new Error('Product not found.')
        Object.assign(p, input, { stockQuantity: p.stockQuantity, updatedAt: now })
        return { ...p }
      }
      const product: Product = {
        ...input,
        name: input.name.trim(),
        sku: input.sku.toUpperCase(),
        id: id('product'),
        slug:
          input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
          '-' +
          crypto.randomUUID().slice(0, 8),
        createdAt: now,
        updatedAt: now,
      }
      draft.products.push(product)
      if (product.stockQuantity)
        draft.movements.push({
          id: id('MOV'),
          productId: product.id,
          productName: product.name,
          type: 'stock-in',
          quantity: product.stockQuantity,
          before: 0,
          after: product.stockQuantity,
          reason: 'Opening stock for new product',
          responsibleUser: actor.name,
          createdAt: now,
        })
      return { ...product }
    })
  },
  async saveCategory(categoryId: string | null, name: string, actor: AuthUser) {
    if (actor.role !== 'owner') throw new Error('Only owners can manage categories.')
    if (name.trim().length < 2)
      throw new Error('Category name must contain at least two characters.')
    mutate((draft) => {
      if (
        draft.categories.some(
          (c) => c.id !== categoryId && c.name.toLowerCase() === name.trim().toLowerCase(),
        )
      )
        throw new Error('This category already exists.')
      if (categoryId) {
        const c = draft.categories.find((c) => c.id === categoryId)
        if (!c) throw new Error('Category not found.')
        c.name = name.trim()
      } else draft.categories.push({ id: id('category'), name: name.trim() })
    })
  },
  async removeCategory(categoryId: string, actor: AuthUser) {
    if (actor.role !== 'owner') throw new Error('Only owners can manage categories.')
    mutate((draft) => {
      if (
        draft.products.some((p) => p.categoryId === categoryId) ||
        draft.sales.some((s) => s.items.some((l) => l.categoryId === categoryId))
      )
        throw new Error(
          'Move all products, including archived products, to another category first.',
        )
      draft.categories = draft.categories.filter((c) => c.id !== categoryId)
    })
  },
}
