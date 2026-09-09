import { categories } from '../../data/grocerySeed'
import { getRevision, projectCatalog, subscribe } from '../mockStore'
import type { ProductQuery, ProductService } from './productService'

function snapshot(query: ProductQuery = {}) {
  const search = query.search?.trim().toLowerCase() ?? ''
  let products = projectCatalog().filter(p =>
    (!search || [p.name,p.sku,p.barcode,p.brand,p.category].join(' ').toLowerCase().includes(search)) &&
    (!query.category || query.category === 'All' || [p.categoryId,p.category].includes(query.category)) &&
    (query.minPrice === undefined || p.price >= query.minPrice) &&
    (query.maxPrice === undefined || p.price <= query.maxPrice) &&
    (!query.featured || p.isFeatured) &&
    (query.availability !== 'in-stock' || (p.stock > 0 && p.isAvailable)) &&
    (query.availability !== 'out-of-stock' || p.stock === 0 || !p.isAvailable))
  if (query.sort === 'price-low') products = products.toSorted((a,b) => a.price-b.price)
  else if (query.sort === 'price-high') products = products.toSorted((a,b) => b.price-a.price)
  else if (query.sort === 'name') products = products.toSorted((a,b) => a.name.localeCompare(b.name))
  else products = products.toSorted((a,b) => Number(b.isFeatured)-Number(a.isFeatured))
  return products
}
export const mockProductService: ProductService = {
  snapshot, categories: () => categories, subscribe, revision: getRevision,
  async list(query) { return { products: snapshot(query), categories: ['All', ...categories.map(c => c.name)] } },
  async get(id) { const product = snapshot().find(p => p.id === id || p.slug === id); if (!product) throw new Error('Product not found.'); return { product } },
}

