import type { CatalogProduct, Category } from '../../types/product'
export type ProductQuery = {
  search?: string
  category?: string
  sort?: string
  minPrice?: number
  maxPrice?: number
  availability?: string
  featured?: boolean
}
export interface ProductService {
  list(query?: ProductQuery): Promise<{ products: CatalogProduct[]; categories: string[] }>
  get(id: string): Promise<{ product: CatalogProduct }>
  snapshot(query?: ProductQuery): CatalogProduct[]
  categories(): Category[]
  subscribe(listener: () => void): () => void
  revision(): number
}
