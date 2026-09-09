import { Download, Printer, QrCode } from 'lucide-react'
import type { Sale } from '../../types/commerce'
import { money } from '../../services/money'
import { settingsService } from '../../services/settingsService'
import { Modal } from '../ui/Modal'
export function ReceiptPreview({sale,onClose,onNew}:{sale:Sale;onClose:()=>void;onNew?:()=>void}) {
  const defaults=settingsService.get()
  const settings={name:sale.storeName??defaults.name,address:sale.storeAddress??defaults.address}
  const save=()=>{
    const text=[settings.name,settings.address,'DEVELOPMENT RECEIPT',sale.receiptNumber,sale.id,new Date(sale.createdAt).toLocaleString('en-PH'),'Cashier: '+sale.cashier,...sale.items.map(l=>`${l.quantity} × ${l.name} @ ${money(l.unitPrice)} = ${money(l.total)}`),`Subtotal: ${money(sale.subtotal)}`,`Discount: ${money(sale.discount)}`,`Tax: ${money(sale.tax)}`,`TOTAL: ${money(sale.total)}`,`Payment: ${sale.paymentMethod}`,`Received: ${money(sale.amountReceived)}`,`Change: ${money(sale.change)}`,'Thank you for shopping with ASCENT!'].join('\n')
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}))
    const link=document.createElement('a');link.href=url;link.download=`${sale.receiptNumber}.txt`;link.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <Modal title="Receipt" className="receipt-modal" onClose={onClose}><article className="receipt-paper" id="print-receipt"><header><h2>{settings.name}</h2><p>{settings.address}</p><small>DEVELOPMENT RECEIPT · PAYMENT DEMO</small></header><dl><dt>Receipt number</dt><dd>{sale.receiptNumber}</dd><dt>Transaction</dt><dd>{sale.id}</dd><dt>Date / time</dt><dd>{new Date(sale.createdAt).toLocaleString('en-PH')}</dd><dt>Cashier / Owner</dt><dd>{sale.cashier}</dd></dl><table><thead><tr><th>Item / unit price</th><th>Qty</th><th>Total</th></tr></thead><tbody>{sale.items.map(item=><tr key={item.productId}><td>{item.name}<small>{money(item.unitPrice)} / {item.unit}</small></td><td>{item.quantity}</td><td>{money(item.total)}</td></tr>)}</tbody></table><dl className="bill-totals">{[['Subtotal',sale.subtotal],['Discount',-sale.discount],['Tax',sale.tax],['Grand total',sale.total],['Amount received',sale.amountReceived],['Change',sale.change]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(Number(value))}</dd></div>)}</dl><p>Payment: {sale.paymentMethod.toUpperCase()}{sale.paymentMethod!=='cash'?' (simulated)':''}</p><footer><p>Thank you for shopping with ASCENT!</p><QrCode size={54}/><small>Receipt lookup placeholder</small></footer></article><div className="action-row no-print"><button className="button button-primary" onClick={()=>window.print()}><Printer size={16}/>Print receipt</button><button className="button button-secondary" onClick={save}><Download size={16}/>Save receipt</button>{onNew&&<button className="button button-secondary" onClick={onNew}>New transaction</button>}<button className="button button-secondary" onClick={onClose}>Close receipt</button></div></Modal>
}
