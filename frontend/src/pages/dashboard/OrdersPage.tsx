import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCommerceRevision } from '../../hooks/useProducts'
import { orderService } from '../../services'
import { money } from '../../services/money'
import { checkoutService, methodLabels, nextStatus } from '../../services/checkout'
import { isSupabaseMode } from '../../services/supabaseClient'
import type { Order } from '../../types/product'
import type { Sale } from '../../types/commerce'
import { ReceiptPreview } from '../../components/pos/ReceiptPreview'
import { PaymentMark } from '../../components/checkout/PaymentMark'
import { Modal } from '../../components/ui/Modal'
import { ordersApi } from '../../services/api'

export function OrdersPage() {
  const { user } = useAuth()
  useCommerceRevision()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<Sale | null>(null),
    [confirm, setConfirm] = useState<Order | null>(null)
  const [cancel, setCancel] = useState<Order | null>(null),
    [received, setReceived] = useState('')
  const [legacy, setLegacy] = useState<Order[]>([])
  useEffect(() => {
    if (isSupabaseMode) return
    let active = true
    ordersApi
      .list()
      .then(({ orders }) => {
        if (active) setLegacy(orders)
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
  const orders = [
    ...local,
    ...legacy.filter((order) => !local.some((row) => row.id === order.id)),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const run = async (operation: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await operation()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The order could not be updated.')
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
          <p>Internal order-status tracking. Staff records payment and fulfillment updates.</p>
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
          {orders.map((order) => {
            const method = order.paymentMethod || 'cash',
              next = nextStatus(order)
            const paid = order.payment?.status === 'succeeded' || order.status === 'Completed'
            return (
              <article key={order.id} data-order-id={order.id}>
                <div className="order-card-top">
                  <span>
                    <small>{order.payment?.isDemo ? 'Demo payment order' : 'Store order'}</small>
                    <strong className="transaction-number">{order.id}</strong>
                  </span>
                  <span className="order-status">{order.status}</span>
                </div>
                <div className="order-card-meta">
                  <span>{new Date(order.createdAt).toLocaleString('en-PH')}</span>
                  <span>{order.fulfillment}</span>
                  <strong>{money(order.total)}</strong>
                </div>
                <div className="order-payment-summary">
                  <PaymentMark method={method} />
                  <div>
                    <strong>{methodLabels[method]}</strong>
                    <p>Payment: {paid ? 'Paid' : order.payment?.status || 'pending'}</p>
                  </div>
                </div>
                {order.contactName && (
                  <p>
                    {order.contactName} · {order.contactPhone}
                  </p>
                )}
                {order.deliveryAddress && <p>Deliver to: {order.deliveryAddress}</p>}
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
                {order.status === 'Awaiting payment' && (
                  <p className="muted">
                    {method === 'cash'
                      ? 'Payment is due at the store counter. Staff will record the amount received.'
                      : method === 'cod'
                        ? 'Cash is due on delivery. Payment remains unpaid until staff records collection.'
                      : order.payment?.status === 'failed'
                        ? 'Payment failed. Retry from the payment screen.'
                        : 'Waiting for digital payment confirmation.'}
                  </p>
                )}
                <div className="action-row">
                  {local.some((row) => row.id === order.id) && <Link className="button button-secondary" to={user.role === 'customer'
                    ? '/account/orders/' + encodeURIComponent(order.id)
                    : '/' + user.role + '/orders/' + encodeURIComponent(order.id)}>
                    Order details & tracking
                  </Link>}
                  {user.role !== 'customer' && method === 'cod' && order.status === 'Out for delivery' && (
                    <button disabled={busy} className="button button-primary" onClick={() => {
                      setConfirm(order)
                      setReceived('')
                    }}>
                      Record COD collection
                    </button>
                  )}
                  {order.status === 'Awaiting payment' &&
                    local.some((row) => row.id === order.id) && (
                      <>
                        {user.role === 'customer' && !['cash', 'cod'].includes(method) && (
                          <Link
                            className="button button-primary"
                            to={'/checkout/' + encodeURIComponent(order.id)}
                          >
                            Continue to payment
                          </Link>
                        )}
                        {user.role !== 'customer' && method === 'cash' && (
                          <button
                            disabled={busy}
                            className="button button-primary"
                            onClick={() => {
                              setConfirm(order)
                              setReceived('')
                            }}
                          >
                            Receive counter payment
                          </button>
                        )}
                        <button
                          disabled={busy}
                          className="button button-secondary"
                          onClick={() => setCancel(order)}
                        >
                          Cancel order
                        </button>
                      </>
                    )}
                  {isSupabaseMode && user.role !== 'customer' && next && (
                    <button
                      disabled={busy}
                      className="button button-primary"
                      onClick={() => void run(() => checkoutService.progress(order.id, next))}
                    >
                      {
                        (
                          {
                            Preparing: 'Start preparing',
                            'Ready for pickup': 'Mark ready for pickup',
                            'Out for delivery': 'Mark out for delivery',
                            Completed: 'Complete order',
                          } as Record<string, string>
                        )[next]
                      }
                    </button>
                  )}
                  {isSupabaseMode && paid && (
                    <button
                      disabled={busy}
                      className="button button-secondary"
                      onClick={() =>
                        void run(async () => setReceipt(await checkoutService.receipt(order.id)))
                      }
                    >
                      View receipt
                    </button>
                  )}
                </div>
                {!!order.events?.length && (
                  <details className="order-timeline">
                    <summary>Order updates</summary>
                    <ol>
                      {order.events.map((event) => (
                        <li key={event.id}>
                          <span>{event.message}</span>
                          <small>
                            {new Date(event.createdAt).toLocaleString('en-PH')} · {event.actor}
                          </small>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <p className="pos-empty">No orders yet.</p>
      )}
      {confirm && (
        <Modal
          title={confirm.paymentMethod === 'cod' ? 'Record COD collection' : 'Receive counter payment'}
          onClose={() => {
            if (!busy) setConfirm(null)
          }}
        >
          <form
            className="operation-form"
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                setReceipt(await orderService.settle(confirm.id, user, Number(received)))
                setConfirm(null)
              })
            }}
          >
            <p>
              Amount due: <strong>{money(confirm.total)}</strong>
            </p>
            <p>
              {confirm.paymentMethod === 'cod'
                ? 'Confirm only after cash is collected on delivery. This records payment and completes the order.'
                : "Confirm only after receiving the customer's cash. Payment is recorded separately from fulfillment."}
            </p>
            <label className="field">
              Cash received
              <input
                required
                type="number"
                min={confirm.total}
                step="0.01"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </label>
            {Number(received) >= confirm.total && (
              <p>Change: {money(Number(received) - confirm.total)}</p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary" disabled={busy}>
              {busy ? 'Recording...' : 'Confirm cash received'}
            </button>
          </form>
        </Modal>
      )}
      {cancel && (
        <Modal
          title="Cancel this order?"
          onClose={() => {
            if (!busy) setCancel(null)
          }}
        >
          <div className="operation-form">
            <p>The unpaid order will be cancelled and reserved stock restored.</p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="button button-primary"
              onClick={() =>
                void run(async () => {
                  await orderService.cancel(cancel.id, user)
                  setCancel(null)
                })
              }
            >
              Confirm cancellation
            </button>
          </div>
        </Modal>
      )}
      {receipt && <ReceiptPreview sale={receipt} onClose={() => setReceipt(null)} />}
    </section>
  )
}
