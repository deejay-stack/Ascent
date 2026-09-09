import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { roleHomePaths } from '../../types/roles'

export function GuestRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <main className="route-loading" aria-live="polite">Checking your session...</main>
  return user ? <Navigate replace to={roleHomePaths[user.role]} /> : <Outlet />
}
