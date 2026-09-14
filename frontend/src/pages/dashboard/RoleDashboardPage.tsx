import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCart } from '../../hooks/useCart'
import { useCommerceRevision } from '../../hooks/useProducts'
import { reportService } from '../../services'
import { localDay } from '../../services/reports/reportService'
import { inventoryService } from '../../services'
import { orderService } from '../../services'
import { money } from '../../services/money'
import type { UserRole } from '../../types/roles'
import type { Sale } from '../../types/commerce'
import { BarChart } from '../../components/reports/BarChart'
import { SalesTable } from '../../components/reports/SalesTable'
import { ReceiptPreview } from '../../components/pos/ReceiptPreview'
export function RoleDashboardPage({ role }: { role: UserRole }) {
  const { user } = useAuth(),
    { itemCount } = useCart()
  useCommerceRevision()
  const [receipt, setReceipt] = useState<Sale | null>(null)
  if (!user) return null
  if (role === 'customer') {
    const orders = orderService.list(user)
    return (
      <section className="operations-page">
        <header className="operations-heading">
          <div>
            <p className="eyebrow">Your account</p>
            <h2>Good to see you, {user.name.split(' ')[0]}.</h2>
          </div>
          <Link className="primary-link" to="/products">
            Browse products
          </Link>
        </header>
        {user.requestedRole && (
          <p role="status">
            Your {user.requestedRole === 'owner' ? 'admin / owner' : 'staff'} access request is
            awaiting owner approval. You can use customer features while it is reviewed. Sign in
            again after approval to open your workspace.
          </p>
        )}
        <div className="compact-stats">
          <article>
            <span>Cart items</span>
            <strong>{itemCount}</strong>
          </article>
          <article>
            <span>Active orders</span>
            <strong>{orders.filter((o) => o.status === 'Awaiting payment').length}</strong>
          </article>
          <article>
            <span>Completed orders</span>
            <strong>{orders.filter((o) => o.status === 'Completed').length}</strong>
          </article>
        </div>
        <Link className="secondary-link" to="/account/orders">
          View all orders
        </Link>
      </section>
    )
  }
  const today = localDay(new Date()),
    daily = reportService.get(user, { from: today, to: today }),
    all = reportService.get(user)
  const prefix = role === 'owner' ? '/owner' : '/staff'
  const alerts = inventoryService
    .list(user)
    .filter((p) => !p.isArchived && p.stockQuantity <= p.lowStockThreshold)
  return (
    <div className="operations-page">
      <header className="operations-heading">
        <div>
          <p className="eyebrow">Today's store overview</p>
          <h2>Good to see you.</h2>
          <p>A clear view of sales and stock, as they happen.</p>
        </div>
        <Link className="primary-link" to={prefix + '/pos'}>
          Start POS <ArrowUpRight size={18} />
        </Link>
      </header>
      <div className="compact-stats">
        {[
          ["Today's sales", money(daily.revenue)],
          ['Transactions today', daily.transactions],
          ['Average transaction', money(daily.average)],
          ['Active products', all.products],
          ['Low stock', all.lowStock],
          ['Out of stock', all.outOfStock],
        ].map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <BarChart title="Sales trend" rows={all.trend} />
      <div className="report-grid">
        <BarChart
          title="Best-selling products · gross sales"
          rows={all.performance
            .filter((p) => p.quantity > 0)
            .slice(0, 5)
            .map((p) => ({ name: `${p.name} (${p.quantity})`, value: p.revenue }))}
        />
        <BarChart
          title="Category performance · before discounts / tax"
          rows={all.categoryPerformance}
        />
      </div>
      <section className="report-panel">
        <header className="operations-heading">
          <h3>Recent transactions</h3>
          {role === 'owner' && (
            <Link className="text-action" to="/owner/reports">
              All reports
            </Link>
          )}
        </header>
        <SalesTable sales={all.sales.slice(0, 5)} onReceipt={setReceipt} />
      </section>
      <section className="report-panel">
        <header className="operations-heading">
          <h3>Inventory alerts ({alerts.length})</h3>
          <Link className="text-action" to={prefix + '/inventory'}>
            Manage inventory
          </Link>
        </header>
        {alerts.length ? (
          <ul className="alert-list">
            {alerts.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <strong className="stock-low">
                  {p.stockQuantity === 0 ? 'Out of stock' : `${p.stockQuantity} left · Low stock`}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>No stock alerts.</p>
        )}
      </section>
      {receipt && <ReceiptPreview sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}
