import { Trash2 } from 'lucide-react'
import type { CatalogProduct } from '../../types/product'
import type { CartItem, PaymentMethod, Totals } from '../../types/commerce'
import { money } from '../../services/money'
import { ProductImage } from '../catalog/ProductImage'
import { QuantityControl } from './QuantityControl'
import { isSupabaseMode } from '../../services/supabaseClient'
import { remoteCache } from '../../services/remote/cache'
type Props = {
  items: CartItem[]
  products: CatalogProduct[]
  transaction: string
  totals: Totals
  discount: string
  taxRate: string
  method: PaymentMethod
  received: string
  busy: boolean
  error: string
  onQuantity: (id: string, n: number) => void
  onRemove: (id: string) => void
  onClear: () => void
  onDiscount: (value: string) => void
  onTax: (value: string) => void
  onMethod: (value: PaymentMethod) => void
  onReceived: (value: string) => void
  onComplete: () => void
}
export function BillingPanel(p: Props) {
  const demoPayments = !isSupabaseMode || remoteCache.get().paymentDemosEnabled
  const change = Math.max(0, (Number(p.received) || 0) - p.totals.total)
  return (
    <aside className="billing-panel">
      <header>
        <p className="eyebrow">Current bill</p>
        <h2>Checkout</h2>
        <small className="transaction-number">{p.transaction}</small>
      </header>
      <div className="billing-lines">
        {p.items.length ? (
          p.items.map((item) => {
            const product = p.products.find((product) => product.id === item.productId)
            if (!product)
              return (
                <div key={item.productId}>
                  Product unavailable{' '}
                  <button disabled={p.busy} onClick={() => p.onRemove(item.productId)}>Remove item</button>
                </div>
              )
            return (
              <article className="billing-line" key={item.productId}>
                <ProductImage product={product} />
                <div>
                  <strong>{product.name}</strong>
                  <small>
                    {money(product.price)} / {product.unit}
                  </small>
                  <QuantityControl
                    disabled={p.busy}
                    name={product.name}
                    value={item.quantity}
                    max={product.isAvailable ? product.stock : 0}
                    onChange={(n) => p.onQuantity(product.id, n)}
                  />
                  <small className={item.quantity > product.stock ? 'stock-low' : ''}>
                    {product.stock - item.quantity} remaining after this bill
                  </small>
                </div>
                <div>
                  <button
                    disabled={p.busy}
                    className="icon-button"
                    aria-label={`Remove ${product.name}`}
                    onClick={() => p.onRemove(product.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                  <strong>{money(product.price * item.quantity)}</strong>
                </div>
              </article>
            )
          })
        ) : (
          <div className="pos-empty">
            Your bill is empty.
            <br />
            Choose a product or scan its barcode.
          </div>
        )}
      </div>
      <button className="text-action" disabled={!p.items.length || p.busy} onClick={p.onClear}>
        Clear bill
      </button>
      <div className="bill-controls">
        <label>
          Discount (₱)
          <input
            disabled={p.busy}
            type="number"
            min="0"
            step=".01"
            value={p.discount}
            onChange={(e) => p.onDiscount(e.target.value)}
          />
        </label>
        <label>
          Tax (%)
          <input
            disabled={p.busy}
            type="number"
            min="0"
            max="100"
            step=".01"
            value={p.taxRate}
            onChange={(e) => p.onTax(e.target.value)}
          />
        </label>
      </div>
      <dl className="bill-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{money(p.totals.subtotal)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>−{money(p.totals.discount)}</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>{money(p.totals.tax)}</dd>
        </div>
        <div className="grand-total">
          <dt>Total</dt>
          <dd>{money(p.totals.total)}</dd>
        </div>
      </dl>
      <label className="field">
        Payment method
        <select disabled={p.busy} value={p.method} onChange={(e) => p.onMethod(e.target.value as PaymentMethod)}>
          <option value="cash">Cash</option>
          {demoPayments && <option value="gcash">GCash · demonstration</option>}
          {demoPayments && <option value="maya">Maya · demonstration</option>}
          {demoPayments && <option value="card">Card · demonstration</option>}
        </select>
      </label>
      {p.method === 'cash' ? (
        <>
          <label className="field">
            Amount received (₱)
            <input
              disabled={p.busy}
              inputMode="decimal"
              type="number"
              min="0"
              step=".01"
              value={p.received}
              onChange={(e) => p.onReceived(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <button disabled={p.busy} className="text-action" onClick={() => p.onReceived(p.totals.total.toFixed(2))}>
            Exact amount
          </button>
          <div className="change-row">
            <span>Change</span>
            <strong>{money(change)}</strong>
          </div>
          {p.received !== '' && Number(p.received) < p.totals.total && (
            <p className="form-error">Insufficient cash received.</p>
          )}
        </>
      ) : (
        <p className="muted">Demonstration only. No funds or card details are collected.</p>
      )}
      {p.error && (
        <p className="form-error" role="alert">
          {p.error}
        </p>
      )}
      <button
        className="button button-primary full-width"
        disabled={!p.items.length || p.busy || !!p.error}
        onClick={p.onComplete}
      >
        {p.busy
          ? 'Processing…'
          : p.method === 'cash'
            ? 'Complete sale'
            : 'Open payment demonstration'}
      </button>
      <p className="muted small">
        {isSupabaseMode ? 'Completed sales and stock movements are saved to the store.' : 'Temporary local transactions · Tax is a configurable demo amount.'}
      </p>
    </aside>
  )
}
