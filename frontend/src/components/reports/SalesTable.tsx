import type { Sale } from '../../types/commerce'
import { money } from '../../services/money'
export function SalesTable({sales,onReceipt}:{sales:Sale[];onReceipt:(sale:Sale)=>void}) {
  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Transaction / date</th><th>Cashier</th><th>Source</th><th>Payment</th><th>Total</th><th>Receipt</th></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td><span className="transaction-number">{s.id}</span><small>{new Date(s.createdAt).toLocaleString('en-PH')}</small></td><td>{s.cashier}</td><td>{s.source}</td><td>{s.paymentMethod.toUpperCase()}</td><td>{money(s.total)}</td><td><button className="text-action" onClick={()=>onReceipt(s)}>Details / reprint</button></td></tr>)}</tbody></table>{!sales.length&&<p className="pos-empty">No completed transactions yet.</p>}</div>
}
