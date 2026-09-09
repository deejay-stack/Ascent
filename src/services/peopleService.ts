import { isSupabaseMode, requireSupabase } from './supabaseClient'
import { request } from './api'
import type { AuthUser } from '../types/auth'
export type Person = AuthUser & { isActive: boolean }
export const peopleService = {
  async list() {
    return (await request<{ users: Person[] }>('/api/people')).users
  },
  async createStaff(name: string, email: string, password: string) {
    return request<{ user: Person }>('/api/people', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
  },
  async setActive(id: string, isActive: boolean) {
    return request('/api/people/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    })
  },
  async updateProfile(name: string, email: string) {
    if (isSupabaseMode) {
      const { error } = await requireSupabase().auth.updateUser({ email, data: { name } })
      if (error) throw error
    }
    return (
      await request<{ user: AuthUser }>('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, email }),
      })
    ).user
  },
}
