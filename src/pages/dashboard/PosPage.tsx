import { Camera, ScanBarcode, Search, ShoppingBag } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useProducts } from '../../hooks/useProducts'
import { paymentService, productService, salesService } from '../../services'
import { calculateTotals, money } from '../../services/money'
import { createScanGuard } from '../../services/posScanner'
import { settingsService } from '../../services/settingsService'
import type { CartItem, Payment, PaymentMethod, Sale } from '../../types/commerce'
import { ProductImage } from '../../components/catalog/ProductImage'
import { BillingPanel } from '../../components/pos/BillingPanel'
import { PaymentModal } from '../../components/pos/PaymentModal'
import { ReceiptPreview } from '../../components/pos/ReceiptPreview'
import { Modal } from '../../components/ui/Modal'
export function PosPage() {
  const {user}=useAuth()
  const products=useProducts()
  const [search,setSearch]=useState(''),[category,setCategory]=useState('All')
  const filtered=useProducts({search,category})
  const [items,setItems]=useState<CartItem[]>([])
  const [transaction,setTransaction]=useState(()=>salesService.nextTransaction())
  const [discount,setDiscount]=useState('0'),[tax,setTax]=useState(()=>String(settingsService.get().taxRate))
  const [method,setMethod]=useState<PaymentMethod>('cash'),[received,setReceived]=useState('')
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [barcode,setBarcode]=useState(''),[camera,setCamera]=useState(false),[tab,setTab]=useState('products')
  const [payment,setPayment]=useState<Payment|null>(null),[receipt,setReceipt]=useState<Sale|null>(null)
  const scanInput=useRef<HTMLInputElement>(null),scanGuard=useRef(createScanGuard())
  let totals={subtotal:0,discount:0,tax:0,total:0},calculationError=''
  try {totals=calculateTotals(items.map(l=>({price:products.find(p=>p.id===l.productId)?.price??0,quantity:l.quantity})),Number(discount),Number(tax))}
  catch(e){calculationError=e instanceof Error?e.message:'Invalid bill.'}
  const add=(id:string)=>{
    const p=productService.snapshot().find(p=>p.id===id)
    const quantity=items.find(l=>l.productId===id)?.quantity??0
    if(!p||!p.isAvailable||p.isArchived){setError('Product unavailable.');return}
    if(quantity>=p.stock){setError(p.stock===0?`${p.name} is out of stock.`:`Only ${p.stock} ${p.name} available.`);return}
    setItems(current=>current.some(l=>l.productId===id)?current.map(l=>l.productId===id?{...l,quantity:l.quantity+1}:l):[...current,{productId:id,quantity:1}])
    setError('');setMessage(`Added ${p.name}`)
  }
  const scan=(event:FormEvent)=>{
    event.preventDefault()
    const code=barcode.trim()
    if(!code)return
    if(!scanGuard.current(code)){setMessage('Duplicate scan ignored.');setBarcode('');scanInput.current?.focus();return}
    const product=productService.snapshot().find(p=>p.barcode===code)
    if(product)add(product.id);else {setError(`Unknown barcode: ${code}`);setMessage('')}
    setBarcode('');scanInput.current?.focus()
  }
  const finalize=async(paymentId?:string)=>{
    if(!user)return
    const sale=await salesService.complete({transactionId:transaction,items,discount:Number(discount),taxRate:Number(tax),paymentMethod:method,amountReceived:Number(received),paymentId,actor:user})
    setItems([]);setDiscount('0');setReceived('');setError('');setMessage('Sale completed. Inventory updated.')
    setPayment(null);setReceipt(sale);setTransaction(salesService.nextTransaction())
  }
  const complete=async()=>{
    if(busy)return
    setBusy(true);setError('')
    try {if(method==='cash'){if(received.trim()==='')throw new Error('Enter the amount received.');await finalize()}else setPayment(await paymentService.begin(transaction,method,totals.total))}
    catch(e){setError(e instanceof Error?e.message:'Sale could not be completed.')}
    finally{setBusy(false)}
  }
  const edit=(fn:()=>void)=>{fn();setError('')}
  return <div className="operations-page"><header className="operations-heading"><div><p className="eyebrow">Counter workspace · Local demonstration</p><h2>Point of sale</h2><p>{new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p></div><button className="button button-secondary" onClick={()=>setCamera(true)}><Camera size={18}/>Camera scanner</button></header><div className="pos-tabs"><button className={tab==='products'?'is-active':''} onClick={()=>setTab('products')}>Products</button><button className={tab==='bill'?'is-active':''} onClick={()=>setTab('bill')}><ShoppingBag size={16}/>Bill ({items.reduce((n,l)=>n+l.quantity,0)}) · {money(totals.total)}</button></div><div className={`pos-layout mobile-${tab}`}><section className="pos-products"><div className="pos-searches"><label className="catalog-search"><Search size={18}/><input aria-label="POS search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, SKU, barcode, brand…"/></label><form onSubmit={scan} className="catalog-search"><ScanBarcode size={20}/><input ref={scanInput} aria-label="Barcode input" value={barcode} onChange={e=>setBarcode(e.target.value)} placeholder="Scan or enter barcode" autoComplete="off"/><button type="submit" className="text-action">Add</button></form></div><label className="field">Category<select value={category} onChange={e=>setCategory(e.target.value)}><option>All</option>{productService.categories().map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><p className="scan-feedback" role="status">{message||'USB scanner ready: focus the barcode field and scan with Enter.'}</p>{error&&<p role="alert" className="form-error">{error}</p>}<div className="pos-grid">{filtered.map(p=><button className="pos-product" key={p.id} disabled={!p.isAvailable||p.stock===0} onClick={()=>add(p.id)} aria-label={`Add ${p.name} to bill`}><ProductImage product={p}/><span><strong>{p.name}</strong><small>{p.unit} · {p.sku}</small><b>{money(p.price)}</b><small className={p.stock<=p.lowStockThreshold?'stock-low':''}>{!p.isAvailable?'Unavailable':p.stock?`${p.stock} in stock`:'Out of stock'}</small></span></button>)}</div>{!filtered.length&&<p className="pos-empty">No matching products. Try another search or category.</p>}</section><BillingPanel items={items} products={products} transaction={transaction} totals={totals} discount={discount} taxRate={tax} method={method} received={received} busy={busy} error={calculationError||error} onQuantity={(id,n)=>edit(()=>setItems(current=>current.map(l=>l.productId===id?{...l,quantity:n}:l)))} onRemove={id=>edit(()=>setItems(current=>current.filter(l=>l.productId!==id)))} onClear={()=>edit(()=>{setItems([]);setDiscount('0');setReceived('')})} onDiscount={v=>edit(()=>setDiscount(v))} onTax={v=>edit(()=>setTax(v))} onMethod={v=>edit(()=>setMethod(v))} onReceived={v=>edit(()=>setReceived(v))} onComplete={()=>void complete()}/></div>{camera&&<Modal title="Camera scanner" onClose={()=>setCamera(false)}><div className="payment-demo"><Camera size={80}/><h3>Camera scanning is coming later.</h3><p>No camera permissions are requested. Use a USB scanner or the barcode input for this demonstration.</p><button className="button button-primary" onClick={()=>{setCamera(false);scanInput.current?.focus()}}>Use barcode input</button></div></Modal>}{payment&&<PaymentModal payment={payment} onSuccess={finalize} onClose={()=>setPayment(null)}/>} {receipt&&<ReceiptPreview sale={receipt} onClose={()=>setReceipt(null)} onNew={()=>{setReceipt(null);setTab('products');scanInput.current?.focus()}}/>}</div>
}
