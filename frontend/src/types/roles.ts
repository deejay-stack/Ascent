export const USER_ROLES = ['customer', 'staff', 'owner'] as const

export type UserRole = (typeof USER_ROLES)[number]

export type Permission =
  | 'shop'
  | 'manage_own_profile'
  | 'manage_orders'
  | 'manage_inventory'
  | 'use_pos'
  | 'manage_staff'
  | 'view_reports'
  | 'manage_settings'

export const roleLabels: Record<UserRole, string> = {
  customer: 'Customer',
  staff: 'Staff',
  owner: 'Owner / Admin',
}

export const roleHomePaths: Record<UserRole, string> = {
  customer: '/account',
  staff: '/staff',
  owner: '/owner',
}

export const rolePermissions: Record<UserRole, readonly Permission[]> = {
  customer: ['shop', 'manage_own_profile'],
  staff: ['manage_own_profile', 'manage_orders', 'manage_inventory', 'use_pos'],
  owner: [
    'shop',
    'manage_own_profile',
    'manage_orders',
    'manage_inventory',
    'use_pos',
    'manage_staff',
    'view_reports',
    'manage_settings',
  ],
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole)
}
