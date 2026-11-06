import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCommerceRevision } from '../../hooks/useProducts'
import { remoteCache } from '../../services/remote/cache'
import { checkoutService } from '../../services/checkout'
import { isSupabaseMode } from '../../services/supabaseClient'
export function OrderNotifications() {
  const { user } = useAuth()
  useCommerceRevision()
  const [open, setOpen] = useState(false),
    [error, setError] = useState('')
  if (!isSupabaseMode || !user) return null
  const rows = remoteCache.get().notifications,
    unread = rows.filter((n) => !n.readAt).length
  const path = user.role === 'customer' ? '/account/orders' : '/' + user.role + '/orders'
  return (
    <div className="order-notifications">
      <button
        type="button"
        className="notification-toggle"
        aria-label={'Order notifications, ' + unread + ' unread'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell size={20} />
        <span aria-live="polite">{unread}</span>
      </button>
      {open && (
        <div className="notification-panel">
          <h3>Order updates</h3>
          {error && <p role="alert">{error}</p>}
          {!rows.length && <p>No order updates yet.</p>}
          {rows.slice(0, 15).map((n) => (
            <Link
              className={n.readAt ? '' : 'is-unread'}
              key={n.id}
              to={path}
              onClick={() => {
                void checkoutService
                  .readNotification(n.id)
                  .catch(() => setError('Could not mark this update as read.'))
                setOpen(false)
              }}
            >
              <strong>{n.message}</strong>
              <small>
                {n.orderId} · {new Date(n.createdAt).toLocaleString('en-PH')}
              </small>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
