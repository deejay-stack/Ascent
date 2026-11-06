import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProductVisual } from '../../components/catalog/ProductVisual'
import { useAuth } from '../../hooks/useAuth'
import { useCart } from '../../hooks/useCart'
import { useProducts, useCommerceRevision } from '../../hooks/useProducts'
import { orderService } from '../../services'
import { cents, money } from '../../services/money'
import type { CatalogProduct as Product } from '../../types/product'
import { isSupabaseMode } from '../../services/supabaseClient'
import { remoteCache } from '../../services/remote/cache'
import { methodLabels, type CheckoutMethod, type CheckoutOption } from '../../services/checkout'
import { PaymentMark } from '../../components/checkout/PaymentMark'
import { Modal } from '../../components/ui/Modal'
import { orderDestination, recoverPendingCheckout } from '../../services/checkoutRecovery'

export function CartPage() {
  const { items, setQuantity, removeItem, clearCart, isSyncing, error: cartError } = useCart()
  const { user } = useAuth()
  const products = useProducts()
  useCommerceRevision()
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup')
  const [method, setMethod] = useState<CheckoutMethod | ''>('')
  const [name, setName] = useState<string | undefined>(),
    [phone, setPhone] = useState(''),
    [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false),
    [review, setReview] = useState(false),
    [error, setError] = useState('')
  const navigate = useNavigate()
  const submitLock = useRef(false)
  useEffect(() => {
    if (!isSupabaseMode || !user?.id) return
    let active = true
    void recoverPendingCheckout(user.id).then((order) => {
      if (active && order) navigate(orderDestination(order), { replace: true })
    }).catch(() => {
      if (active) setError('A previous checkout could not be checked. Reconnect and reload this page before placing another order.')
    })
    return () => { active = false }
  }, [user?.id, navigate])
  const lines = useMemo(
    () =>
      items
        .map((item) => ({ ...item, product: products.find((p) => p.id === item.productId) }))
        .filter((line): line is typeof line & { product: Product } => Boolean(line.product)),
    [items, products],
  )
  const total =
    lines.reduce((sum, line) => sum + cents(line.product.price) * line.quantity, 0) / 100
  const methods: CheckoutOption[] = isSupabaseMode
    ? remoteCache.get().checkoutMethods
    : [
        {
          id: 'cash',
          label: 'Over the counter',
          available: true,
          isDemo: false,
          description: 'Pay cash at the store.',
        },
      ]
  const reviewOrder = (event: FormEvent) => {
    event.preventDefault()
    if (!user) {
      navigate('/login', { state: { from: '/cart' } })
      return
    }
    if (user.role !== 'customer') {
      setError('Checkout requires a customer account.')
      return
    }
    if (!method || isSyncing || cartError) return
    setError('')
    setReview(true)
  }
  const checkout = async () => {
    if (!user || !method || submitLock.current || isSyncing || cartError) return
    submitLock.current = true
    setSubmitting(true)
    setError('')
    try {
      const { order } = await orderService.create(items, fulfillment, user, {
        paymentMethod: method,
        confirmed: true,
        contactName: name ?? user.name,
        contactPhone: phone,
        deliveryAddress: fulfillment === 'delivery' ? address : '',
        expectedTotal: total,
      })
      if (!isSupabaseMode) clearCart()
      setReview(false)
      navigate(orderDestination(order))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout could not be completed.')
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }
  return (
    <div className="cart-page">
      <header className="cart-header">
        <div>
          <p className="eyebrow">Your basket</p>
          <h1>Review your cart.</h1>
        </div>
        <Link className="details-back" to="/products">
          <ArrowLeft size={17} /> Continue shopping
        </Link>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!items.length ? (
        <section className="empty-cart">
          <ShoppingBag size={48} />
          <h2>Your cart is empty.</h2>
          <Link className="primary-link" to="/products">
            Browse products
          </Link>
        </section>
      ) : (
        <div className="cart-layout">
          <section className="cart-lines" aria-label="Cart items">
            {lines.map(({ product, quantity }) => (
              <article className="cart-line" key={product.id}>
                <ProductVisual compact product={product} />
                <div className="cart-line-copy">
                  <p>{product.category}</p>
                  <Link to={'/products/' + product.id}>{product.name}</Link>
                  <small>
                    {money(product.price)} / {product.unit}
                  </small>
                </div>
                <div className="quantity-control">
                  <button
                    aria-label={'Decrease ' + product.name}
                    disabled={submitting || review || isSyncing}
                    onClick={() => setQuantity(product.id, quantity - 1)}
                  >
                    <Minus size={16} />
                  </button>
                  <span>{quantity}</span>
                  <button
                    aria-label={'Increase ' + product.name}
                    disabled={submitting || review || isSyncing || quantity >= product.stock}
                    onClick={() => setQuantity(product.id, quantity + 1)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <strong>{money(product.price * quantity)}</strong>
                <button
                  aria-label={'Remove ' + product.name}
                  disabled={submitting || review || isSyncing}
                  className="remove-line"
                  onClick={() => removeItem(product.id)}
                >
                  <Trash2 size={18} />
                </button>
              </article>
            ))}
          </section>
          <form className="order-summary checkout-summary" onSubmit={reviewOrder}>
            <p className="eyebrow">Checkout</p>
            <h2>Delivery & payment</h2>
            <label className="field">
              Fulfillment
              <select
                value={fulfillment}
                onChange={(e) => {
                  setFulfillment(e.target.value as 'pickup' | 'delivery')
                  if (e.target.value === 'pickup' && method === 'cod') setMethod('')
                }}
              >
                <option value="pickup">Store pickup</option>
                <option value="delivery">Local delivery</option>
              </select>
            </label>
            <label className="field">
              Contact name
              <input
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                value={name ?? user?.name ?? ''}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              Contact number
              <input
                required
                type="tel"
                minLength={7}
                maxLength={30}
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            {fulfillment === 'delivery' && (
              <label className="field">
                Delivery address
                <textarea
                  required
                  minLength={10}
                  maxLength={500}
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
            )}
            <fieldset className="payment-options">
              <legend>Choose a payment method</legend>
              {methods.map((option) => (
                <label
                  key={option.id}
                  className={'payment-option ' + (method === option.id ? 'is-selected' : '')}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option.id}
                    required
                    checked={method === option.id}
                    disabled={!option.available || (option.id === 'cod' && fulfillment !== 'delivery')}
                    onChange={() => setMethod(option.id)}
                  />
                  <PaymentMark method={option.id} />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="summary-total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            <p className="summary-note">
              Review and confirm before your order is placed. No additional delivery charge is
              collected in this demo.
            </p>
            {(error || cartError) && (
              <p className="form-error" role="alert">
                {error || cartError}
              </p>
            )}
            <button
              className="button button-primary"
              disabled={submitting || isSyncing || !!cartError || !lines.length}
              type={user ? 'submit' : 'button'}
              onClick={() => {
                if (!user) navigate('/login', { state: { from: '/cart' } })
              }}
            >
              {isSyncing ? 'Saving cart...' : user ? 'Review order' : 'Sign in to checkout'}
            </button>
          </form>
        </div>
      )}
      {review && method && (
        <Modal
          title="Confirm your order"
          onClose={() => {
            if (!submitting) setReview(false)
          }}
        >
          <div className="operation-form">
            <p>
              {lines.reduce((n, l) => n + l.quantity, 0)} items ·{' '}
              {fulfillment === 'pickup' ? 'Store pickup' : 'Local delivery'}
            </p>
            <p>
              {name ?? user?.name} · {phone}
            </p>
            {fulfillment === 'delivery' && <p>{address}</p>}
            <p>
              <strong>{methodLabels[method]}</strong>
            </p>
            <h3>Total: {money(total)}</h3>
            <p>
              {method === 'cod'
                ? 'Pay cash on delivery. Staff records collection when the order is delivered.'
                : method === 'cash'
                ? 'Your order will wait for staff to confirm cash received at the counter.'
                : 'Next: demo wallet checkout. No real money will be collected.'}
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button
              className="button button-primary"
              disabled={submitting}
              onClick={() => void checkout()}
            >
              {submitting
                ? 'Confirming...'
                : method === 'cod'
                  ? 'Confirm order — cash on delivery'
                : method === 'cash'
                  ? 'Confirm order — pay at counter'
                  : 'Confirm order and continue to payment'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
