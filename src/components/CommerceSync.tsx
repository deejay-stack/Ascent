import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseMode, supabaseClient } from '../services/supabaseClient'
import { remoteCache } from '../services/remote/cache'
export function CommerceSync({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const [readyFor, setReadyFor] = useState<string | null>(null)
  useSyncExternalStore(remoteCache.subscribe, remoteCache.revision, remoteCache.revision)
  const identity = user?.id ?? 'guest'
  useEffect(() => {
    if (!isSupabaseMode || isLoading) return
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'store_events' }, refresh)
      .subscribe()
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      if (channel) void supabaseClient?.removeChannel(channel)
    }
  }, [identity, isLoading])
  if (!isSupabaseMode) return children
  const status = remoteCache.status()
  if (isLoading || readyFor !== identity)
    return <main className="route-loading">Connecting to ASCENT…</main>
  if (status.error && !remoteCache.get().products.length)
    return (
      <main className="centered-state">
        <h1>Store connection unavailable</h1>
        <p>{status.error}</p>
        <button
          className="button button-primary"
          onClick={() => void remoteCache.refresh().catch(() => undefined)}
        >
          Retry connection
        </button>
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
