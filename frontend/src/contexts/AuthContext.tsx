import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser } from '../types/auth'
import type { UserRole } from '../types/roles'
import { authApi } from '../services/api'
import { AuthContext } from './authContextValue'
import { supabaseClient } from '../services/supabaseClient'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    authApi
      .session()
      .then((sessionUser) => {
        if (active) {
          setUser(sessionUser)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setUser(null)
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const nextUser = await authApi.signIn(email, password)
    setUser(nextUser)
    return nextUser
  }, [])

  const registerCustomer = useCallback(
    async (name: string, email: string, password: string, requestedRole: UserRole = 'customer') => {
      const nextUser = await authApi.register(name, email, password, requestedRole)
      setUser(nextUser)
      return nextUser
    },
    [],
  )

  const recoverPassword = useCallback(
    async (email: string) => (await authApi.recover(email)).message,
    [],
  )
  const refreshUser = useCallback(async () => {
    try {
      setUser(await authApi.session())
    } catch {
      /* Keep the current identity through a temporary service outage. */
    }
  }, [])
  useEffect(() => {
    const subscription = supabaseClient?.auth.onAuthStateChange(() => {
      setTimeout(() => {
        void refreshUser()
      }, 0)
    })
    return () => subscription?.data.subscription.unsubscribe()
  }, [refreshUser])
  useEffect(() => {
    const refresh = () => {
      void refreshUser()
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refreshUser])

  const signOut = useCallback(async () => {
    try {
      await authApi.signOut()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      signIn,
      registerCustomer,
      recoverPassword,
      signOut,
      refreshUser,
    }),
    [isLoading, recoverPassword, registerCustomer, signIn, signOut, user, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
