import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Clock3, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCommerceRevision } from '../../hooks/useProducts'
import { orderService } from '../../services'
import { checkoutService, methodLabels } from '../../services/checkout'
import { remoteCache } from '../../services/remote/cache'
import { money } from '../../services/money'
import { PaymentMark } from '../../components/checkout/PaymentMark'

export function CheckoutPaymentPage() {
  const { orderId } = useParams(),
    { user } = useAuth()
  useCommerceRevision()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [attempt, setAttempt] = useState<{ outcome: string; id: string } | null>(null)
  const order = user && orderService.list(user).find((o) => o.id === orderId)
  if (!order)
    return (
      <section className="centered-state">
        <h1>Order not found.</h1>
        <Link to="/account/orders">View your orders</Link>
      </section>
    )
  const method = order.paymentMethod || 'cash'
  const paid = order.payment?.status === 'succeeded',
    pending = order.payment?.status === 'pending'
  const simulate = async (outcome: 'succeeded' | 'failed' | 'pending') => {
    if (busy) return
    setBusy(true)
    setError('')
    const id = attempt?.outcome === outcome ? attempt.id : crypto.randomUUID()
    setAttempt({ outcome, id })
    try {
      await checkoutService.simulate(order.id, outcome, id)
      setAttempt(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update payment.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={'wallet-checkout wallet-' + method}>
      <Link className="details-back" to="/account/orders">
        ← Your orders
      </Link>
      <div className="wallet-card">
        <div className="demo-payment-banner">{order.payment?.isDemo
          ? 'DEMO CHECKOUT · No real money moves'
          : method === 'cod' ? 'CASH ON DELIVERY · Staff records collection' : 'COUNTER PAYMENT · Staff confirms receipt'}</div>
        <div className="wallet-heading">
          <PaymentMark method={method} />
          <div>
            <p className="eyebrow">Payment method</p>
            <h1>{methodLabels[method]}</h1>
          </div>
        </div>
        <p>
          Pay to <strong>{remoteCache.get().settings.name}</strong>
        </p>
        <div className="wallet-amount">{money(order.total)}</div>
        <p className="transaction-number">{order.id}</p>
        <p>
          {order.contactName} · {order.fulfillment}
        </p>
        {paid ? (
          <div className="payment-result" role="status">
            <CheckCircle2 size={44} />
            <h2>{order.payment?.isDemo ? 'Demo payment confirmed' : 'Payment confirmed'}</h2>
            <p>Staff has been notified and can prepare your order.</p>
            <Link className="button button-primary" to="/account/orders">
              Track your order
            </Link>
            <Link className="secondary-link" to={'/account/orders/' + encodeURIComponent(order.id)}>View order confirmation</Link>
          </div>
        ) : order.status === 'Cancelled' ? (
          <div role="status">
            <h2>Order cancelled</h2>
            <p>No payment was collected.</p>
          </div>
        ) : method === 'cash' || method === 'cod' ? (
          <p>{method === 'cod' ? 'Pay cash on delivery. Staff records collection when delivered.' : 'Pay at the store counter. Staff will confirm receipt of your payment.'}</p>
        ) : !order.payment?.isDemo || !remoteCache.get().paymentDemosEnabled ? (
          <p>Digital demo payments are currently unavailable. Your order remains unpaid.</p>
        ) : (
          <>
            <p className="payment-state">
              <Clock3 size={18} />{' '}
              {pending ? 'Awaiting payment confirmation' : 'Payment failed — try again'}
            </p>
            <p>
              This preview demonstrates the payment process. Do not enter a real wallet password,
              PIN or OTP.
            </p>
            <div className="wallet-actions">
              <button
                disabled={busy}
                className="button button-primary"
                onClick={() => void simulate('succeeded')}
              >
                {busy ? 'Processing...' : 'Simulate successful payment'}
              </button>
              <button
                disabled={busy}
                className="button button-secondary"
                onClick={() => void simulate('pending')}
              >
                Simulate pending payment
              </button>
              <button
                disabled={busy}
                className="text-action"
                onClick={() => void simulate('failed')}
              >
                Simulate failed payment
              </button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <p className="wallet-footer">
          <ShieldCheck size={17} /> {order.payment?.isDemo ? 'Demo payment status' : 'Payment status'} is stored with your order.
        </p>
      </div>
    </section>
  )
}
