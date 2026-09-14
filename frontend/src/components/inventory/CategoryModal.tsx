import { useState, type FormEvent } from 'react'
import type { AuthUser } from '../../types/auth'
import { productService, productManagementService } from '../../services'
import { useCommerceRevision } from '../../hooks/useProducts'
import { Modal } from '../ui/Modal'
export function CategoryModal({ actor, onClose }: { actor: AuthUser; onClose: () => void }) {
  useCommerceRevision()
  const [name, setName] = useState(''),
    [editing, setEditing] = useState<string | null>(null),
    [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await productManagementService.saveCategory(editing, name, actor)
      setName('')
      setEditing(null)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Category update failed.')
    }
  }
  return (
    <Modal title="Manage categories" onClose={onClose}>
      <form className="operation-form" onSubmit={submit}>
        <label className="field">
          Category name
          <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="action-row">
          <button className="button button-primary">
            {editing ? 'Save category' : 'Add category'}
          </button>
          {editing && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setEditing(null)
                setName('')
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <ul className="alert-list">
        {productService.categories().map((c) => (
          <li key={c.id}>
            <span>{c.name}</span>
            <div className="action-row">
              <button
                className="text-action"
                onClick={() => {
                  setEditing(c.id)
                  setName(c.name)
                }}
              >
                Rename
              </button>
              <button
                className="text-action"
                onClick={() =>
                  void productManagementService
                    .removeCategory(c.id, actor)
                    .catch((error) => setError(error.message))
                }
              >
                Remove unused
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
