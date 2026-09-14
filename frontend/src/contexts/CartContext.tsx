import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { CartContext, type CartLine } from './cartContextValue'
import { productService } from '../services'
import { mockStorage } from '../services/storage/mockStorage'
import { useProducts } from '../hooks/useProducts'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseMode } from '../services/supabaseClient'
import { RemoteCartProvider } from './RemoteCartContext'
const key=isSupabaseMode ? 'ascent-guest-cart-v1' : 'ascent-grocery-cart-v1'
function readCart():CartLine[] {
  const saved=mockStorage.read<CartLine[]>(key,[])
  return Array.isArray(saved)?saved.filter(l=>typeof l.productId==='string'&&Number.isSafeInteger(l.quantity)&&l.quantity>0):[]
}
export function CartProvider({children}:{children:ReactNode}) {
  const { user } = useAuth()
  if (isSupabaseMode && user?.role === 'customer') return <RemoteCartProvider key={user.id} userId={user.id}>{children}</RemoteCartProvider>
  return <LocalCartProvider>{children}</LocalCartProvider>
}
function LocalCartProvider({children}:{children:ReactNode}) {
  const [storedItems,setStoredItems]=useState<CartLine[]>(readCart)
  const products=useProducts()
  const items=useMemo(()=>storedItems.flatMap(l=>{
    const p=products.find(p=>p.id===l.productId)
    return p&&p.isAvailable&&p.stock>0?[{...l,quantity:Math.min(l.quantity,p.stock)}]:[]
  }),[storedItems,products])
  const update=useCallback((fn:(current:CartLine[])=>CartLine[])=>{
    setStoredItems(current=>{
      const available=productService.snapshot()
      const valid=current.flatMap(l=>{const p=available.find(p=>p.id===l.productId);return p&&p.isAvailable&&p.stock>0?[{...l,quantity:Math.min(l.quantity,p.stock)}]:[]})
      const next=fn(valid)
      mockStorage.write(key,next)
      return next
    })
  },[])
  const addItem=useCallback((productId:string)=>update(current=>{
    const p=productService.snapshot().find(p=>p.id===productId)
    if(!p||!p.isAvailable||p.stock===0)return current
    const existing=current.find(l=>l.productId===productId)
    if(existing&&existing.quantity>=p.stock)return current
    return existing?current.map(l=>l.productId===productId?{...l,quantity:l.quantity+1}:l):[...current,{productId,quantity:1}]
  }),[update])
  const setQuantity=useCallback((productId:string,quantity:number)=>update(current=>{
    const p=productService.snapshot().find(p=>p.id===productId)
    if(!Number.isSafeInteger(quantity))return current
    if(quantity<=0||!p||!p.isAvailable)return current.filter(l=>l.productId!==productId)
    return current.map(l=>l.productId===productId?{...l,quantity:Math.min(quantity,p.stock)}:l)
  }),[update])
  const removeItem=useCallback((id:string)=>setQuantity(id,0),[setQuantity])
  const clearCart=useCallback(()=>update(()=>[]),[update])
  const itemCount=items.reduce((sum,l)=>sum+l.quantity,0)
  const value=useMemo(()=>({items,itemCount,addItem,setQuantity,removeItem,clearCart,isSyncing:false,error:''}),[items,itemCount,addItem,setQuantity,removeItem,clearCart])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
