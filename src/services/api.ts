import { productService } from './index'
import { mockStorage } from './storage/mockStorage'
import type { AuthUser } from '../types/auth'
import type { Order } from '../types/product'

const tokenKey = 'ascent-session-token'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = mockStorage.getText(tokenKey)
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const body = (await response.json().catch(() => ({}))) as { message?: string } & T
  if (!response.ok) throw new ApiError(body.message || 'The request could not be completed.', response.status)
  return body
}

export const authApi = {
  async signIn(email: string, password: string) {
    const result = await request<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    })
    mockStorage.setText(tokenKey, result.token)
    return result.user
  },
  async register(name: string, email: string, password: string) {
    const result = await request<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST', body: JSON.stringify({ name, email, password }),
    })
    mockStorage.setText(tokenKey, result.token)
    return result.user
  },
  recover(email: string) {
    return request<{ message: string }>('/api/auth/recover', { method: 'POST', body: JSON.stringify({ email }) })
  },
  async session() {
    if (!mockStorage.getText(tokenKey)) return null
    try {
      return (await request<{ user: AuthUser }>('/api/auth/session')).user
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) mockStorage.remove(tokenKey)
      return null
    }
  },
  async signOut() {
    try { await request('/api/auth/session', { method: 'DELETE' }) } finally { mockStorage.remove(tokenKey) }
  },
}

export const catalogApi = productService

export const ordersApi = {
  list() { return request<{ orders: Order[] }>('/api/orders') },
  create(items: { productId: string; quantity: number }[], fulfillment: 'pickup' | 'delivery') {
    return request<{ order: Order }>('/api/orders', { method: 'POST', body: JSON.stringify({ items, fulfillment }) })
  },
}
