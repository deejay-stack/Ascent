import type { ProductService, ProductQuery } from '../products/productService'
import type { InventoryService } from '../inventory/inventoryService'
import type { SalesService } from '../sales/salesService'
import type { PaymentService } from '../payments/paymentService'
import type { AuthUser } from '../../types/auth'
import type { CartItem, Payment, Sale, StoreSettings } from '../../types/commerce'
import type { CatalogProduct, Order } from '../../types/product'
import type { ProductInput } from '../products/productManagementService'
import { remoteCache, remoteWrite } from './cache'
import { request } from '../api'
import { mockStorage } from '../storage/mockStorage'
import { summarize, localDay, type ReportFilter } from '../reports/reportService'
function products(query: ProductQuery = {}): CatalogProduct[] {
  const state = remoteCache.get(),
    search = query.search?.trim().toLowerCase() ?? ''
  const rows = state.products
    .filter((p) => !p.isArchived)
    .map((p) => {
      const { costPrice, ...fields } = p
      void costPrice
      return {
        ...fields,
        price: p.sellingPrice,
        stock: p.stockQuantity,
        category: state.categories.find((c) => c.id === p.categoryId)?.name ?? p.categoryId,
      }
    })
    .filter(
      (p) =>
        (!search ||
          [p.name, p.sku, p.barcode, p.brand, p.category]
            .join(' ')
            .toLowerCase()
            .includes(search)) &&
        (!query.category ||
          query.category === 'All' ||
          [p.categoryId, p.category].includes(query.category)) &&
        (query.minPrice === undefined || p.price >= query.minPrice) &&
        (query.maxPrice === undefined || p.price <= query.maxPrice) &&
        (!query.featured || p.isFeatured) &&
        (query.availability !== 'in-stock' || (p.stock > 0 && p.isAvailable)) &&
        (query.availability !== 'out-of-stock' || p.stock === 0 || !p.isAvailable),
    )
  return rows.sort(
    query.sort === 'name'
      ? (a, b) => a.name.localeCompare(b.name)
      : query.sort === 'price-low'
        ? (a, b) => a.price - b.price
        : query.sort === 'price-high'
          ? (a, b) => b.price - a.price
          : (a, b) => Number(b.isFeatured) - Number(a.isFeatured),
  )
}
export const apiProductService: ProductService = {
  snapshot: products,
  categories: () => remoteCache.get().categories,
  subscribe: remoteCache.subscribe,
  revision: remoteCache.revision,
  async list(query) {
    await remoteCache.refresh()
    return {
      products: products(query),
      categories: ['All', ...remoteCache.get().categories.map((c) => c.name)],
    }
  },
  async get(id) {
    await remoteCache.refresh()
    const product = products().find((p) => p.id === id || p.slug === id)
    if (!product) throw new Error('Product not found.')
    return { product }
  },
}
export const apiInventoryService: InventoryService = {
  list: () => remoteCache.get().products,
  movements: () => remoteCache.get().movements,
  async adjust({ actor, ...input }) {
    void actor
    await remoteWrite('/api/inventory/adjustments', input)
  },
  async updateProduct(id, fields) {
    await remoteWrite('/api/products/' + encodeURIComponent(id), fields, 'PATCH')
  },
}
export const apiSalesService: SalesService = {
  list: () => remoteCache.get().sales,
  nextTransaction: () => 'ASC-' + crypto.randomUUID(),
  async complete({ actor, ...input }) {
    void actor
    return (await remoteWrite<{ sale: Sale }>('/api/sales', input)).sale
  },
}
export const apiPaymentService: PaymentService = {
  async begin(transactionId, method, total) {
    return (
      await request<{ payment: Payment }>('/api/payments/demo', {
        method: 'POST',
        body: JSON.stringify({ transactionId, method, total }),
      })
    ).payment
  },
  async simulate(id, outcome) {
    return (
      await request<{ payment: Payment }>('/api/payments/' + encodeURIComponent(id) + '/simulate', {
        method: 'POST',
        body: JSON.stringify({ outcome }),
      })
    ).payment
  },
  // Confirmation is verified by Express against its persisted payment record.
  verify: () => false,
}
export const apiOrderService = {
  list: (_actor: AuthUser) => {
    void _actor
    return remoteCache.get().orders
  },
  async create(items: CartItem[], fulfillment: 'pickup' | 'delivery', _actor: AuthUser) {
    const key = 'ascent-checkout-request-' + _actor.id
    const signature = JSON.stringify({ items, fulfillment })
    const previous = mockStorage.read<{ signature: string; orderId: string } | null>(key, null)
    const orderId = previous?.signature === signature ? previous.orderId : 'ORD-' + crypto.randomUUID()
    mockStorage.write(key, { signature, orderId })
    const result = await remoteWrite<{ order: Order }>('/api/orders', {
      items,
      fulfillment,
      orderId,
    })
    mockStorage.remove(key)
    return result
  },
  async settle(id: string, _actor: AuthUser) {
    void _actor
    return (
      await remoteWrite<{ sale: Sale }>('/api/orders/' + encodeURIComponent(id) + '/settle', {})
    ).sale
  },
  async cancel(id: string, _actor: AuthUser) {
    void _actor
    await remoteWrite('/api/orders/' + encodeURIComponent(id) + '/cancel', {})
  },
}
export const apiSettingsService = {
  get: () => remoteCache.get().settings,
  async save(settings: StoreSettings, _actor: AuthUser) {
    void _actor
    await remoteWrite('/api/settings', settings, 'PATCH')
  },
}
export const apiProductManagementService = {
  async save(id: string | null, input: ProductInput, _actor: AuthUser) {
    void _actor
    return (
      await remoteWrite<{ product: ProductInput }>(
        '/api/products' + (id ? '/' + encodeURIComponent(id) : ''),
        input,
        id ? 'PATCH' : 'POST',
      )
    ).product
  },
  async saveCategory(id: string | null, name: string, _actor: AuthUser) {
    void _actor
    await remoteWrite(
      '/api/categories' + (id ? '/' + encodeURIComponent(id) : ''),
      { name },
      id ? 'PATCH' : 'POST',
    )
  },
  async removeCategory(id: string, _actor: AuthUser) {
    void _actor
    await remoteWrite('/api/categories/' + encodeURIComponent(id), undefined, 'DELETE')
  },
}
export const apiUploadService = {
  async productImage(file: File) {
    const body = new FormData()
    body.append('image', file)
    return (await request<{ imageUrl: string }>('/api/uploads/product', { method: 'POST', body }))
      .imageUrl
  },
}
export const apiReportService = {
  get(_actor: AuthUser, filter: ReportFilter = {}) {
    void _actor
    const state = remoteCache.get()
    const sales = state.sales.filter(
      (s) =>
        (!filter.from || localDay(s.createdAt) >= filter.from) &&
        (!filter.to || localDay(s.createdAt) <= filter.to) &&
        (!filter.payment || s.paymentMethod === filter.payment) &&
        (!filter.source || s.source === filter.source),
    )
    return {
      ...summarize(
        sales,
        state.products.map((p) => ({ ...p, costPrice: p.costPrice ?? 0 })),
        state.categories,
      ),
      sales,
    }
  },
}
