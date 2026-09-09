import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCommerceRevision } from '../../hooks/useProducts'
import { reportService } from '../../services'
import { money } from '../../services/money'
import type { Sale } from '../../types/commerce'
import { BarChart } from '../../components/reports/BarChart'
import { SalesTable } from '../../components/reports/SalesTable'
import { ReceiptPreview } from '../../components/pos/ReceiptPreview'
export function ReportsPage() {
  const { user } = useAuth()
  useCommerceRevision()
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [payment, setPayment] = useState(''),
    [source, setSource] = useState(''),
    [receipt, setReceipt] = useState<Sale | null>(null)
  if (!user) return null
  const report = reportService.get(user, { from, to, payment, source })
  return (
    <div className="operations-page">
      <header className="operations-heading">
        <div>
          <p className="eyebrow">Business overview · Local records</p>
          <h2>Sales & reports</h2>
          <p>Completed transactions only. Unpaid orders are excluded.</p>
        </div>
      </header>
      <div className="table-filters">
        <label className="field">
          From date
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          To date
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="field">
          Payment method
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="">All methods</option>
            {['cash', 'gcash', 'maya', 'card'].map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Sales source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            <option value="pos">POS</option>
            <option value="online">Online</option>
          </select>
        </label>
        <button
          className="text-action"
          onClick={() => {
            setFrom('')
            setTo('')
            setPayment('')
            setSource('')
          }}
        >
          Clear filters
        </button>
      </div>
      {from && to && from > to && (
        <p className="form-error" role="alert">
          From date must be before to date.
        </p>
      )}
      <div className="compact-stats">
        <article>
          <span>Net sales including demo tax</span>
          <strong>{money(report.revenue)}</strong>
        </article>
        <article>
          <span>Transactions</span>
          <strong>{report.transactions}</strong>
        </article>
        <article>
          <span>Average transaction</span>
          <strong>{money(report.average)}</strong>
        </article>
      </div>
      <BarChart title="Sales trend · Philippine dates" rows={report.trend} />
      <div className="report-grid">
        <BarChart
          title="Category performance · before discounts / tax"
          rows={report.categoryPerformance}
        />
        <BarChart
          title="Best sellers · gross product sales"
          rows={report.performance
            .filter((p) => p.quantity > 0)
            .slice(0, 5)
            .map((p) => ({ name: `${p.name} (${p.quantity} sold)`, value: p.revenue }))}
        />
      </div>
      <section className="report-panel">
        <h3>Transactions</h3>
        <SalesTable sales={report.sales} onReceipt={setReceipt} />
      </section>
      <section className="report-panel">
        <h3>Product performance</h3>
        <p className="muted">Sorted by units sold. Zero-sale products are included.</p>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Units sold</th>
                <th>Gross sales</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {report.performance.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.quantity}</td>
                  <td>{money(p.revenue)}</td>
                  <td>
                    {p.quantity === 0 ? 'No sales' : p.quantity <= 2 ? 'Low volume' : 'Selling'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {receipt && <ReceiptPreview sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}
