import { useMemo, useSyncExternalStore } from 'react'
import { productService } from '../services'
import type { ProductQuery } from '../services/products/productService'
export function useCommerceRevision() {
  return useSyncExternalStore(productService.subscribe, productService.revision, productService.revision)
}
export function useProducts(query: ProductQuery = {}) {
  const revision = useCommerceRevision()
  const {search,category,sort,minPrice,maxPrice,availability,featured} = query
  return useMemo(()=>{ void revision; return productService.snapshot({search,category,sort,minPrice,maxPrice,availability,featured}) },[revision,search,category,sort,minPrice,maxPrice,availability,featured])
}
