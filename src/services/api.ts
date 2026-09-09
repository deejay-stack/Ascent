import { isSupabaseMode, requireSupabase } from './supabaseClient'
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

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = isSupabaseMode
    ? (await requireSupabase().auth.getSession()).data.session?.access_token
    : mockStorage.getText(tokenKey)
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const body = (await response.json().catch(() => ({}))) as { message?: string } & T
  if (!response.ok)
    throw new ApiError(body.message || 'The request could not be completed.', response.status)
  return body
}

export const authApi = {
  async signIn(email: string, password: string) {
    if (isSupabaseMode) {
      const { error } = await requireSupabase().auth.signInWithPassword({ email, password })
      if (error) throw error
      return (await request<{ user: AuthUser }>('/api/me')).user
    }
    const result = await request<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    mockStorage.setText(tokenKey, result.token)
    return result.user
  },
  async register(name: string, email: string, password: string) {
    if (isSupabaseMode) {
      const { data, error } = await requireSupabase().auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo: window.location.origin + '/auth/callback' },
      })
      if (error) throw error
      if (!data.session)
        throw new Error('Account created. Check your email to confirm your address, then sign in.')
      return (await request<{ user: AuthUser }>('/api/me')).user
    }
    const result = await request<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    mockStorage.setText(tokenKey, result.token)
    return result.user
  },
  async recover(email: string) {
    if (isSupabaseMode) {
      const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      })
      if (error) throw error
      return { message: 'If an account exists, a password reset link has been sent.' }
    }
    return request<{ message: string }>('/api/auth/recover', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },
  async session() {
    if (isSupabaseMode) {
      const { data } = await requireSupabase().auth.getSession()
      if (!data.session) return null
      try {
        return (await request<{ user: AuthUser }>('/api/me')).user
      } catch {
        return null
      }
    }
    if (!mockStorage.getText(tokenKey)) return null
    try {
      return (await request<{ user: AuthUser }>('/api/auth/session')).user
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) mockStorage.remove(tokenKey)
      return null
    }
  },
  async signOut() {
    if (isSupabaseMode) {
      const { error } = await requireSupabase().auth.signOut()
      if (error) throw error
      return
    }
    try {
      await request('/api/auth/session', { method: 'DELETE' })
    } finally {
      mockStorage.remove(tokenKey)
    }
  },
}

export const catalogApi = productService

export const ordersApi = {
  list() {
    return request<{ orders: Order[] }>('/api/orders')
  },
  create(items: { productId: string; quantity: number }[], fulfillment: 'pickup' | 'delivery') {
    return request<{ order: Order }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items, fulfillment }),
    })
  },
}
