import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../types/roles'

type ProtectedRouteProps = { allowedRoles: readonly UserRole[] }

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <main className="route-loading" aria-live="polite">Loading your workspace...</main>
  if (!user) return <Navigate replace state={{ from: location.pathname }} to="/login" />
  if (!allowedRoles.includes(user.role)) return <Navigate replace to="/unauthorized" />
  return <Outlet />
}
