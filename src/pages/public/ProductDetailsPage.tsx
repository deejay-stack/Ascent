import { ArrowLeft, ShoppingCart, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ProductVisual } from '../../components/catalog/ProductVisual'
import { QuantityControl } from '../../components/pos/QuantityControl'
import { useCart } from '../../hooks/useCart'
import { useProducts } from '../../hooks/useProducts'
import { money } from '../../services/money'
export function ProductDetailsPage() {
  const {productId=''}=useParams()
  const product=useProducts().find(p=>p.id===productId||p.slug===productId)
  const [quantity,setQuantity]=useState(1),[added,setAdded]=useState(false)
  const {addItem,items}=useCart()
  if(!product)return <section className="catalog-status details-status"><h1>Product unavailable</h1><Link className="secondary-link" to="/products">Return to catalog</Link></section>
  const remaining=product.stock-(items.find(l=>l.productId===product.id)?.quantity??0)
  const selected=Math.min(quantity,Math.max(1,remaining))
  return <article className="product-details-page"><Link className="details-back" to="/products"><ArrowLeft size={17}/>Back to catalog</Link><div className="product-details-grid"><ProductVisual product={product}/><div className="product-details-copy"><p className="eyebrow">{product.category}</p><h1>{product.name}</h1><p className="details-unit">{product.unit} · {product.brand}</p><strong className="details-price">{money(product.price)}</strong><p className="details-description">{product.description}</p><p>SKU: {product.sku}<br/>Barcode: {product.barcode}</p><div className="availability-note">{!product.isAvailable?'Unavailable':product.stock===0?'Out of stock':product.stock<=product.lowStockThreshold?`Low stock: only ${product.stock} left`:`${product.stock} available today`}</div><div className="details-buy-row"><QuantityControl name={product.name} value={selected} max={remaining} onChange={n=>{setQuantity(n);setAdded(false)}}/><button className="button button-primary" disabled={!product.isAvailable||remaining<=0} onClick={()=>{for(let i=0;i<selected;i++)addItem(product.id);setAdded(true)}}><ShoppingCart size={18}/>{added?'Added to cart':remaining<=0?'Unavailable / stock limit':'Add to cart'}</button></div><div className="fulfillment-note"><Truck size={20}/><span><strong>Pickup or local delivery</strong><small>Choose your fulfillment option during checkout.</small></span></div></div></div></article>
}
