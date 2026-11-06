import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCommerceRevision } from '../../hooks/useProducts'
import { orderService } from '../../services'
import { methodLabels } from '../../services/checkout'
import { money } from '../../services/money'

export function OrderDetailsPage() {
  const { orderId } = useParams()
  const { user } = useAuth()
  useCommerceRevision()
  if (!user) return null
  const base = user.role === 'customer' ? '/account/orders' : '/' + user.role + '/orders'
  const order = orderService.list(user).find((row) => row.id === orderId)
  if (!order) return <section className="centered-state">
    <h1>Order not found.</h1>
    <p>This order is unavailable for your account.</p>
    <Link className="primary-link" to={base}>View orders</Link>
  </section>
  const method = order.paymentMethod || 'cash'
  const paid = order.payment?.status === 'succeeded' || order.status === 'Completed'
  return <section className="operations-page order-detail-page">
    <header className="operations-heading">
      <div><p className="eyebrow">{user.role === 'customer' ? 'Order received' : 'Order details'}</p>
        <h1 className="transaction-number">{order.id}</h1>
        <p>Placed {new Date(order.createdAt).toLocaleString('en-PH')}</p>
      </div>
      <Link className="secondary-link" to={base}>{user.role === 'customer' ? 'Order history' : 'Manage orders'}</Link>
    </header>
    <div className="order-list"><article>
      <h2>Order confirmation</h2>
      <p>Fulfillment: <strong>{order.status}</strong></p>
      <p>Payment: <strong>{paid ? 'Paid' : order.payment?.status || 'pending'}</strong> · {methodLabels[method]}</p>
      {order.payment?.isDemo && <p className="demo-payment-banner">SIMULATED PAYMENT · No real money moves</p>}
      <p>{order.fulfillment} · {order.contactName || user.name} {order.contactPhone}</p>
      {order.deliveryAddress && <p>Deliver to: {order.deliveryAddress}</p>}
      {method === 'cod' && !paid && order.status !== 'Cancelled' && <p>Cash is due on delivery. Staff records collection after receiving your payment.</p>}
      {method === 'cash' && !paid && order.status !== 'Cancelled' && <p>Pay at the store counter. Staff confirms your payment before preparation.</p>}
      <ul>{order.items.map((item) => <li key={item.productId}>
        <span>{item.quantity} × {item.name} · {money(item.price)} / {item.unit}</span>
        <strong>{money(item.lineTotal)}</strong>
      </li>)}</ul>
      <p>Subtotal: {money(order.subtotal)}</p>
      <p>Delivery fee: {money(0)}</p>
      <h3>Total: {money(order.total)}</h3>
      {user.role === 'customer' && !['cash', 'cod'].includes(method) && !paid && order.status !== 'Cancelled' &&
        <Link className="primary-link" to={'/checkout/' + encodeURIComponent(order.id)}>Continue to payment</Link>}
    </article><article id="tracking">
      <h2>Internal order-status tracking</h2>
      <p>Current status: <strong>{order.status}</strong>. Updates are recorded by the store.</p>
      {order.events?.length ? <ol className="order-timeline">{order.events.map((event) => <li key={event.id}>
        <p>{event.message}</p><small>{new Date(event.createdAt).toLocaleString('en-PH')} · {event.actor}</small>
      </li>)}</ol> : <p>No additional updates have been recorded.</p>}
    </article></div>
  </section>
}
