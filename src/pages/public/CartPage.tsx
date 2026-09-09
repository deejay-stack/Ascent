import { ArrowLeft, CheckCircle2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProductVisual } from '../../components/catalog/ProductVisual'
import { useAuth } from '../../hooks/useAuth'
import { useCart } from '../../hooks/useCart'
import { useProducts } from '../../hooks/useProducts'
import { orderService } from '../../services'
import { cents } from '../../services/money'
import type { Order, CatalogProduct as Product } from '../../types/product'

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export function CartPage() {
  const { items, setQuantity, removeItem, clearCart } = useCart()
  const { user } = useAuth()
  const products = useProducts()
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)
  const navigate = useNavigate()

  const lines = useMemo(() => items.map((item) => ({ ...item, product: products.find((product) => product.id === item.productId) })).filter((line): line is typeof line & { product: Product } => Boolean(line.product)), [items, products])
  const subtotal = lines.reduce((sum, line) => sum + cents(line.product.price) * line.quantity, 0) / 100

  const checkout = async () => {
    if (!user) { navigate('/login', { state: { from: '/cart' } }); return }
    if (user.role !== 'customer') { setError('Checkout is available from a customer account.'); return }
    setSubmitting(true); setError('')
    try {
      const result = await orderService.create(items, fulfillment, user)
      setCompletedOrder(result.order)
      clearCart()
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Checkout could not be completed.')
    } finally { setSubmitting(false) }
  }

  if (completedOrder) return <section className="checkout-success"><CheckCircle2 size={52} /><p className="eyebrow">Order confirmed</p><h1>Thanks, {user?.name.split(' ')[0]}.</h1><p>Your order <strong>{completedOrder.id}</strong> is now processing for {completedOrder.fulfillment.toLowerCase()}.</p><div><Link className="primary-link" to="/account/orders">Track order</Link><Link className="secondary-link" to="/products">Keep shopping</Link></div></section>

  return (
    <div className="cart-page">
      <header className="cart-header"><div><p className="eyebrow">Your basket</p><h1>Review your cart.</h1></div><Link className="details-back" to="/products"><ArrowLeft size={17} /> Continue shopping</Link></header>
      {!items.length ? <section className="empty-cart"><ShoppingBag size={48} /><h2>Your cart is empty.</h2><p>Explore the catalog and add your everyday essentials.</p><Link className="primary-link" to="/products">Browse products</Link></section> : (
        <div className="cart-layout">
          <section className="cart-lines" aria-label="Cart items">
            {lines.map(({ product, quantity }) => <article className="cart-line" key={product.id}><ProductVisual compact product={product} /><div className="cart-line-copy"><p>{product.category}</p><Link to={`/products/${product.id}`}>{product.name}</Link><small>{peso.format(product.price)} / {product.unit}</small></div><div className="quantity-control"><button aria-label={`Decrease ${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)} type="button"><Minus size={16} /></button><span>{quantity}</span><button aria-label={`Increase ${product.name}`} disabled={quantity >= product.stock} onClick={() => setQuantity(product.id, quantity + 1)} type="button"><Plus size={16} /></button></div><strong>{peso.format(product.price * quantity)}</strong><button aria-label={`Remove ${product.name}`} className="remove-line" onClick={() => removeItem(product.id)} type="button"><Trash2 size={18} /></button></article>)}
          </section>
          <aside className="order-summary"><p className="eyebrow">Order summary</p><h2>{items.reduce((sum, item) => sum + item.quantity, 0)} items</h2><div className="fulfillment-options"><label className={fulfillment === 'pickup' ? 'is-active' : ''}><input checked={fulfillment === 'pickup'} name="fulfillment" onChange={() => setFulfillment('pickup')} type="radio" /><span><strong>Store pickup</strong><small>Ready-time shown after confirmation</small></span></label><label className={fulfillment === 'delivery' ? 'is-active' : ''}><input checked={fulfillment === 'delivery'} name="fulfillment" onChange={() => setFulfillment('delivery')} type="radio" /><span><strong>Local delivery</strong><small>Delivery fee confirmed by the store</small></span></label></div><div className="summary-total"><span>Subtotal</span><strong>{peso.format(subtotal)}</strong></div><p className="summary-note">No card details are collected. Payment is arranged at pickup or delivery.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={submitting || !lines.length} onClick={checkout} type="button">{submitting ? 'Placing order...' : user ? 'Place order' : 'Sign in to checkout'}</button></aside>
        </div>
      )}
    </div>
  )
}
