import { useState, type FormEvent } from 'react'
import type { Product } from '../../types/product'
import type { AuthUser } from '../../types/auth'
import { productService, productManagementService, uploadService } from '../../services'
import type { ProductInput } from '../../services/products/productManagementService'
import { ProductImage } from '../catalog/ProductImage'
import { Modal } from '../ui/Modal'
import imageMap from '../../data/productImages.json'
import { productImagePlaceholder } from '../../services/productImages'

const imageLibrary = [...new Set(Object.values(imageMap))].filter(
  (url) => url !== productImagePlaceholder,
)

export function ProductEditModal({
  product,
  actor,
  onClose,
}: {
  product?: Omit<Product, 'costPrice'> & { costPrice?: number }
  actor: AuthUser
  onClose: () => void
}) {
  const [form, setForm] = useState<ProductInput>(() => ({
    name: product?.name ?? '',
    description: product?.description ?? '',
    categoryId: product?.categoryId ?? productService.categories()[0]?.id ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    imageUrl: product?.imageUrl ?? productImagePlaceholder,
    sellingPrice: product?.sellingPrice ?? 0,
    costPrice: product?.costPrice ?? 0,
    stockQuantity: product?.stockQuantity ?? 0,
    lowStockThreshold: product?.lowStockThreshold ?? 7,
    unit: product?.unit ?? 'piece',
    brand: product?.brand ?? '',
    isAvailable: product?.isAvailable ?? true,
    isArchived: product?.isArchived ?? false,
    isFeatured: product?.isFeatured ?? false,
  }))
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await productManagementService.save(product?.id ?? null, form, actor)
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Product could not be saved.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={product ? 'Edit product' : 'Create product'}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form className="operation-form" onSubmit={submit}>
        <label className="field">
          Product name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <div className="bill-controls">
          <label className="field">
            Selling price (₱)
            <input
              required
              type="number"
              min="0"
              step=".01"
              value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Cost price (Owner only)
            <input
              required
              type="number"
              min="0"
              step=".01"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="field">
          Description
          <textarea
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className="field">
          Category
          <select
            required
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            {productService.categories().map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="bill-controls">
          <label className="field">
            SKU
            <input
              required
              pattern={'[A-Za-z0-9\\-]{3,40}'}
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </label>
          <label className="field">
            Barcode
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{8,14}"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
          </label>
          <label className="field">
            Unit
            <input
              required
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </label>
          <label className="field">
            Brand
            <input
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </label>
          {!product && (
            <label className="field">
              Opening stock
              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.stockQuantity}
                onChange={(e) => setForm({ ...form, stockQuantity: Number(e.target.value) })}
              />
            </label>
          )}
          <label className="field">
            Low-stock threshold
            <input
              required
              type="number"
              min="0"
              step="1"
              value={form.lowStockThreshold}
              onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
            />
          </label>
        </div>
        {product && (
          <p className="muted">Use Adjust stock to change stock quantities and record a reason.</p>
        )}
        <label className="field">
          Choose a supplied photo
          <select
            disabled={busy}
            value={
              imageLibrary.includes(form.imageUrl) || form.imageUrl === productImagePlaceholder
                ? form.imageUrl
                : 'custom'
            }
            onChange={(e) => setForm((current) => ({ ...current, imageUrl: e.target.value }))}
          >
            <option value={productImagePlaceholder}>No photo yet</option>
            {!imageLibrary.includes(form.imageUrl) && form.imageUrl !== productImagePlaceholder && (
              <option value="custom">Current uploaded photo</option>
            )}
            {imageLibrary.map((url) => (
              <option key={url} value={url}>
                {url
                  .split('/')
                  .at(-1)
                  ?.replace(/\.[^.]+$/, '')
                  .replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Product image
          <input
            disabled={busy}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setBusy(true)
              setError('')
              try {
                const imageUrl = await uploadService.productImage(file)
                setForm((current) => ({ ...current, imageUrl }))
              } catch (error) {
                setError(error instanceof Error ? error.message : 'Upload failed.')
              } finally {
                setBusy(false)
              }
            }}
          />
        </label>
        <p className="muted">Upload a JPG, PNG or WebP image up to 2 MB.</p>
        <ProductImage
          product={{
            name: form.name || 'New product',
            imageUrl: form.imageUrl,
          }}
          className="editor-image"
        />
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
          />
          Featured product
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.isAvailable}
            onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
          />
          Available for sale
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.isArchived}
            onChange={(e) => setForm({ ...form, isArchived: e.target.checked })}
          />
          Archived
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-primary" disabled={busy}>
          {busy ? 'Saving…' : product ? 'Save product' : 'Create product'}
        </button>
      </form>
    </Modal>
  )
}
