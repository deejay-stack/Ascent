import type { Category, Product, Order } from '../../types/product'
import type { Sale, InventoryMovement, StoreSettings } from '../../types/commerce'
import { request } from '../api'
export type RemoteProduct = Omit<Product, 'costPrice'> & { costPrice?: number }
export type RemoteSnapshot = {
  products: RemoteProduct[]
  categories: Category[]
  sales: Sale[]
  movements: InventoryMovement[]
  orders: Order[]
  settings: StoreSettings
}
const empty = (): RemoteSnapshot => ({
  products: [],
  categories: [],
  sales: [],
  movements: [],
  orders: [],
  settings: { name: 'ASCENT', address: 'Store address', taxRate: 0 },
})
let state = empty(),
  revision = 0,
  epoch = 0,
  loading = false,
  error = ''
const listeners = new Set<() => void>()
let inFlight: Promise<void> | null = null
const publish = () => {
  revision++
  listeners.forEach((l) => l())
}
export const remoteCache = {
  get: () => state,
  revision: () => revision,
  status: () => ({ loading, error }),
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  clear: () => {
    epoch++
    state = empty()
    inFlight = null
    error = ''
    loading = false
    publish()
  },
  async refresh(force = false): Promise<void> {
    if (inFlight) {
      if (!force) return inFlight
      await inFlight.catch(() => undefined)
      return remoteCache.refresh()
    }
    const current = epoch
    loading = true
    publish()
    const task = request<RemoteSnapshot>('/api/snapshot')
      .then((value) => {
        if (current === epoch) {
          state = value
          error = ''
        }
      })
      .catch((e) => {
        if (current === epoch) error = e instanceof Error ? e.message : 'Unable to load store data.'
        throw e
      })
      .finally(() => {
        if (current === epoch) {
          loading = false
          inFlight = null
          publish()
        }
      })
    inFlight = task
    return task
  },
}
export async function remoteWrite<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  const result = await request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  // A committed sale must still return its receipt if a follow-up refresh fails.
  await remoteCache.refresh(true).catch(() => undefined)
  return result
}
