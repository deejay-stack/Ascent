import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProductCard } from '../../components/catalog/ProductCard'
import { Modal } from '../../components/ui/Modal'
import { productService } from '../../services'
import { useProducts } from '../../hooks/useProducts'
export function ProductCatalogPage() {
  const [params, setParams] = useSearchParams()
  const [drawer, setDrawer] = useState(false),
    [loading, setLoading] = useState(true)
  const search = params.get('search') || '',
    category = params.get('category') || 'All',
    sort = params.get('sort') || 'featured'
  const availability = params.get('availability') || '',
    min = params.get('min') || '',
    max = params.get('max') || ''
  const limit = Math.max(12, Number(params.get('limit')) || 12)
  const products = useProducts({
    search,
    category,
    sort,
    availability,
    minPrice: min ? Number(min) : undefined,
    maxPrice: max ? Number(max) : undefined,
    featured: params.get('featured') === 'true',
  })
  const allProducts = useProducts()
  const [loadError, setLoadError] = useState('')
  const retry = async () => {
    setLoading(true)
    setLoadError('')
    try {
      await productService.list()
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load the catalog.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    let active = true
    productService
      .list()
      .catch((error) => {
        if (active)
          setLoadError(error instanceof Error ? error.message : 'Unable to load the catalog.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'limit') next.delete('limit')
    setParams(next, { replace: true })
  }
  const filters = (
    <div className="catalog-filter-fields">
      <label className="field">
        Category
        <select value={category} onChange={(e) => update('category', e.target.value)}>
          <option>All</option>
          {productService.categories().map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Minimum price (₱)
        <input type="number" min="0" value={min} onChange={(e) => update('min', e.target.value)} />
      </label>
      <label className="field">
        Maximum price (₱)
        <input type="number" min="0" value={max} onChange={(e) => update('max', e.target.value)} />
      </label>
      <label className="field">
        Availability
        <select value={availability} onChange={(e) => update('availability', e.target.value)}>
          <option value="">All availability</option>
          <option value="in-stock">In stock</option>
          <option value="out-of-stock">Out of stock / unavailable</option>
        </select>
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={params.get('featured') === 'true'}
          onChange={(e) => update('featured', e.target.checked ? 'true' : '')}
        />
        Featured only
      </label>
      <button className="text-action" onClick={() => setParams({})}>
        Clear filters
      </button>
    </div>
  )
  return (
    <div className="catalog-page">
      <header className="catalog-hero">
        <p className="eyebrow">Product catalog</p>
        <h1>
          Everyday goods,
          <br />
          ready when you are.
        </h1>
        <p>Familiar grocery essentials, thoughtfully stocked for your everyday.</p>
      </header>
      <section className="catalog-toolbar" aria-label="Catalog search and sorting">
        <label className="catalog-search">
          <Search size={20} />
          <input
            aria-label="Search products"
            value={search}
            onChange={(e) => update('search', e.target.value)}
            placeholder="Search name, SKU, barcode, brand or category"
          />
          {search && (
            <button aria-label="Clear search" onClick={() => update('search', '')}>
              <X size={17} />
            </button>
          )}
        </label>
        <label className="catalog-sort">
          <SlidersHorizontal size={18} />
          <span className="sr-only">Sort products</span>
          <select value={sort} onChange={(e) => update('sort', e.target.value)}>
            <option value="featured">Featured first</option>
            <option value="name">Name A–Z</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </label>
        <button
          className="button button-secondary mobile-filter-button"
          onClick={() => setDrawer(true)}
        >
          Filters
        </button>
      </section>
      <section className="desktop-filters" aria-label="Catalog filters">
        {filters}
      </section>
      <div className="catalog-results-heading">
        <p>
          <strong>{products.length}</strong> products found
        </p>
      </div>
      {min && max && Number(min) > Number(max) && (
        <p role="alert" className="form-error">
          Minimum price must not exceed maximum price.
        </p>
      )}
      {loadError && (
        <p className="form-error" role="alert">
          {loadError}{' '}
          <button className="text-action" disabled={loading} onClick={() => void retry()}>
            Retry catalog
          </button>
        </p>
      )}
      {loading ? (
        <div className="catalog-grid" aria-label="Loading catalog">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="product-skeleton" />
          ))}
        </div>
      ) : products.length ? (
        <>
          <section className="catalog-grid">
            {products.slice(0, limit).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </section>
          {products.length > limit && (
            <button
              className="button button-secondary load-more"
              onClick={() => update('limit', String(limit + 12))}
            >
              Load more products ({products.length - limit} remaining)
            </button>
          )}
        </>
      ) : (
        <div className="catalog-status">
          <h2>
            {loadError
              ? 'Catalog unavailable.'
              : allProducts.length
                ? 'No products match your search.'
                : 'The store is preparing its catalog.'}
          </h2>
          <p>
            {allProducts.length
              ? 'Try another term or clear your filters.'
              : 'Products will appear here as the store adds its available inventory.'}
          </p>
          {allProducts.length > 0 && (
            <button className="button button-secondary" onClick={() => setParams({})}>
              Clear filters
            </button>
          )}
        </div>
      )}
      {drawer && (
        <Modal title="Filter products" className="filter-modal" onClose={() => setDrawer(false)}>
          {filters}
          <button className="button button-primary" onClick={() => setDrawer(false)}>
            Show {products.length} products
          </button>
        </Modal>
      )}
    </div>
  )
}
