export type AuthMode = 'signin' | 'create' | 'recover'

import type { UserRole } from './roles'

export type Theme = 'light' | 'dark'

export type DemoCredential = {
  role: UserRole
  label: string
  email: string
  hint: string
}

export type AuthUser = {
  id: string
  name: string
  email: string
  role: UserRole
  requestedRole?: 'staff' | 'owner' | null
}

export type FeaturePoint = {
  label: string
  value: string
  detail: string
}
