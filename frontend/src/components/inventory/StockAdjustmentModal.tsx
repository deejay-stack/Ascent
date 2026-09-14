import { useState, type FormEvent } from 'react'
import type { AuthUser } from '../../types/auth'
import { inventoryService } from '../../services'
import { Modal } from '../ui/Modal'
export function StockAdjustmentModal({
  product,
  actor,
  onClose,
}: {
  product: { id: string; name: string; stockQuantity: number }
  actor: AuthUser
  onClose: () => void
}) {
  const [type, setType] = useState<'stock-in' | 'stock-out' | 'adjustment'>('stock-in'),
    [quantity, setQuantity] = useState(''),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const after =
    type === 'adjustment'
      ? Number(quantity)
      : product.stockQuantity + Number(quantity) * (type === 'stock-out' ? -1 : 1)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (
      !quantity.trim() ||
      !Number.isSafeInteger(Number(quantity)) ||
      after < 0 ||
      after === product.stockQuantity
    ) {
      setError('Enter a whole quantity that changes stock without making it negative.')
      return
    }
    setBusy(true)
    try {
      await inventoryService.adjust({
        productId: product.id,
        type,
        quantity: Number(quantity),
        reason,
        actor,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Adjustment failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={`Adjust stock: ${product.name}`}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form className="operation-form" onSubmit={submit}>
        <label className="field">
          Movement type
          <select
            disabled={busy}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="stock-in">Stock-in</option>
            <option value="stock-out">Stock-out</option>
            <option value="adjustment">Set counted stock</option>
          </select>
        </label>
        <label className="field">
          {type === 'adjustment' ? 'New stock count' : 'Quantity'}
          <input
            required
            disabled={busy}
            type="number"
            min={type === 'adjustment' ? 0 : 1}
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="field">
          Adjustment reason
          <textarea
            required
            disabled={busy}
            minLength={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Delivery received, damage, stock count…"
          />
        </label>
        <p>
          Before: <strong>{product.stockQuantity}</strong> → After:{' '}
          <strong>{quantity.trim() ? after : '—'}</strong>
        </p>
        <p>Responsible user: {actor.name}</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save adjustment'}
        </button>
      </form>
    </Modal>
  )
}
