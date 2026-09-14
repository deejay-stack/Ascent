import { isSupabaseMode } from '../../services/supabaseClient'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCommerceRevision } from '../../hooks/useProducts'
import { orderService } from '../../services'
import { ordersApi } from '../../services/api'
import { money } from '../../services/money'
import type { Order } from '../../types/product'
import type { Sale } from '../../types/commerce'
import { ReceiptPreview } from '../../components/pos/ReceiptPreview'
import { Modal } from '../../components/ui/Modal'
export function OrdersPage() {
  const { user } = useAuth()
  useCommerceRevision()
  const [legacy, setLegacy] = useState<Order[]>([]),
    [error, setError] = useState(''),
    [receipt, setReceipt] = useState<Sale | null>(null),
    [confirm, setConfirm] = useState<Order | null>(null),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    if (isSupabaseMode) return
    let active = true
    ordersApi
      .list()
      .then((r) => {
        if (active) setLegacy(r.orders)
      })
      .catch(() => {
        if (active)
          setError('Previous backend orders could not be loaded. Local orders are available.')
      })
    return () => {
      active = false
    }
  }, [])
  if (!user) return null
  const local = orderService.list(user)
  const orders = [...local, ...legacy].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const settle = async () => {
    if (!confirm || busy) return
    setBusy(true)
    try {
      setReceipt(await orderService.settle(confirm.id, user))
      setConfirm(null)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to settle order.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="operations-page">
      <header className="operations-heading">
        <div>
          <p className="eyebrow">{user.role === 'customer' ? 'Your purchases' : 'Online orders'}</p>
          <h2>{user.role === 'customer' ? 'My orders' : 'Orders & fulfillment'}</h2>
          <p>Orders reserve stock. Sales reports update after payment is recorded.</p>
        </div>
        {user.role === 'customer' && (
          <Link className="primary-link" to="/products">
            Shop products
          </Link>
        )}
      </header>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {orders.length ? (
        <div className="order-list">
          {orders.map((order) => (
            <article key={order.id}>
              <div className="order-card-top">
                <span>
                  <small>
                    {local.some((o) => o.id === order.id)
                      ? isSupabaseMode ? 'Store order' : 'Local order'
                      : 'Previous backend order'}
                  </small>
                  <strong className="transaction-number">{order.id}</strong>
                </span>
                <span className="order-status">{order.status}</span>
              </div>
              <div className="order-card-meta">
                <span>{new Date(order.createdAt).toLocaleString('en-PH')}</span>
                <span>{order.fulfillment}</span>
                <strong>{money(order.total)}</strong>
              </div>
              <ul>
                {order.items.map((item) => (
                  <li key={item.productId}>
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    <span>{money(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              {user.role !== 'customer' &&
                order.status === 'Awaiting payment' &&
                local.some((o) => o.id === order.id) && (
                  <div className="action-row">
                    <button className="button button-primary" onClick={() => setConfirm(order)}>
                      Record payment / fulfill
                    </button>
                    <button
                      className="button button-secondary"
                      onClick={() => {
                        void orderService
                          .cancel(order.id, user)
                          .catch((e) =>
                            setError(e instanceof Error ? e.message : 'Cancellation failed.'),
                          )
                      }}
                    >
                      Cancel and restore stock
                    </button>
                  </div>
                )}
            </article>
          ))}
        </div>
      ) : (
        <p className="pos-empty">No orders yet.</p>
      )}
      {confirm && (
        <Modal title="Record order payment" onClose={() => { if (!busy) setConfirm(null) }}>
          <p>
            Confirm that exact cash of <strong>{money(confirm.total)}</strong> was received for this
            order. Stock was reserved at checkout.
          </p>
          <button className="button button-primary" disabled={busy} onClick={() => void settle()}>
            Confirm exact cash received
          </button>
        </Modal>
      )}
      {receipt && <ReceiptPreview sale={receipt} onClose={() => setReceipt(null)} />}
    </section>
  )
}
