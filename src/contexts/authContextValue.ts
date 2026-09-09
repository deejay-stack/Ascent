import { createContext } from 'react'
import type { AuthUser } from '../types/auth'
export type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<AuthUser>
  registerCustomer: (name: string, email: string, password: string) => Promise<AuthUser>
  recoverPassword: (email: string) => Promise<string>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
