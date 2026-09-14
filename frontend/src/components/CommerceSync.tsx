import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseMode, supabaseClient } from '../services/supabaseClient'
import { remoteCache } from '../services/remote/cache'
import { Link, useLocation, useNavigate } from 'react-router-dom'
export function CommerceSync({ children }: { children: ReactNode }) {
  const { user, isLoading, signOut } = useAuth()
  const location = useLocation(),
    navigate = useNavigate()
  const authenticationPage = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
  ].includes(location.pathname)
  const [readyFor, setReadyFor] = useState<string | null>(null)
  useSyncExternalStore(remoteCache.subscribe, remoteCache.revision, remoteCache.revision)
  const identity = user?.id ?? 'guest'
  useEffect(() => {
    if (!isSupabaseMode || isLoading || authenticationPage) return
    let active = true
    remoteCache.clear()
    void remoteCache
      .refresh()
      .finally(() => {
        if (active) setReadyFor(identity)
      })
      .catch(() => undefined)
    const refresh = () => {
      void remoteCache.refresh().catch(() => undefined)
    }
    const channel = supabaseClient
      ?.channel('ascent-store-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'store_events' }, () => {
        void remoteCache.refresh(true).catch(() => undefined)
      })
      .subscribe()
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      if (channel) void supabaseClient?.removeChannel(channel)
    }
  }, [identity, isLoading, authenticationPage])
  if (!isSupabaseMode || authenticationPage) return children
  const status = remoteCache.status()
  if (isLoading || readyFor !== identity)
    return <main className="route-loading">Connecting to ASCENT…</main>
  if (status.error && !status.hasLoaded)
    return (
      <main className="centered-state">
        <h1>Store connection unavailable</h1>
        <p>{status.error}</p>
        <button
          className="button button-primary"
          disabled={status.loading}
          onClick={() => void remoteCache.refresh().catch(() => undefined)}
        >
          {status.loading ? 'Connecting…' : 'Retry connection'}
        </button>
        {user ? (
          <button
            className="button button-secondary"
            onClick={() => void signOut().finally(() => navigate('/login'))}
          >
            Sign in again
          </button>
        ) : (
          <Link className="primary-link" to="/login">
            Sign in
          </Link>
        )}
      </main>
    )
  return (
    <>
      {children}
      <div className="connection-indicator" role="status">
        {status.error
          ? 'Connection interrupted — showing last loaded data'
          : status.loading
            ? 'Syncing…'
            : 'Connected to Supabase'}
      </div>
    </>
  )
}
