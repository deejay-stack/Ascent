import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CartContext, type CartLine } from './cartContextValue'
import { useCommerceRevision } from '../hooks/useProducts'
import { remoteCache, remoteWrite } from '../services/remote/cache'
import { mockStorage } from '../services/storage/mockStorage'
import { requireSupabase } from '../services/supabaseClient'

type Action = {
  action: 'add' | 'set' | 'remove' | 'clear' | 'merge'
  productId?: string
  quantity?: number
  items?: CartLine[]
  id?: string
}
const guestKey = 'ascent-guest-cart-v1'
export function RemoteCartProvider({ userId, children }: { userId: string; children: ReactNode }) {
  useCommerceRevision()
  const items = remoteCache.get().cart.items
  const [pending, setPending] = useState(0)
  const [error, setError] = useState('')
  const [failed, setFailed] = useState<Action | null>(null)
  const queue = useRef(Promise.resolve())
  const active = useRef(true)

  const enqueue = useCallback(
    (action: Action) => {
      const input = { ...action, id: action.id || crypto.randomUUID(), userId }
      setPending((value) => value + 1)
      const task = queue.current
        .then(async () => {
          if (!active.current) return
          const { data } = await requireSupabase().auth.getSession()
          if (data.session?.user.id !== userId)
            throw new Error('Sign in again before updating this cart.')
          await remoteWrite('/api/cart/actions', input)
          if (remoteCache.status().error)
            throw new Error(
              'Cart saved, but the updated cart could not be loaded. Retry to refresh it safely.',
            )
          if (input.action === 'merge') {
            mockStorage.remove(guestKey)
            mockStorage.remove('ascent-guest-cart-merge-id')
          }
          if (active.current) {
            setError('')
            setFailed(null)
          }
        })
        .catch((reason) => {
          if (active.current) {
            setError(reason instanceof Error ? reason.message : 'The cart could not be saved.')
            setFailed(input)
          }
        })
        .finally(() => {
          if (active.current) setPending((value) => value - 1)
        })
      queue.current = task
    },
    [userId],
  )

  useEffect(() => {
    active.current = true
    // Retry IDs make a guest-cart import safe across StrictMode, reloads and lost responses.
    void Promise.resolve().then(() => {
      if (!active.current) return
      const guest = mockStorage.read<CartLine[]>(guestKey, [])
      if (!Array.isArray(guest) || !guest.length) return
      const valid = guest
        .filter(
          (line) =>
            typeof line.productId === 'string' &&
            Number.isSafeInteger(line.quantity) &&
            line.quantity > 0,
        )
        .slice(0, 300)
      const id = mockStorage.getText('ascent-guest-cart-merge-id') || crypto.randomUUID()
      mockStorage.setText('ascent-guest-cart-merge-id', id)
      enqueue({ action: 'merge', items: valid, id })
    })
    return () => {
      active.current = false
    }
  }, [enqueue])

  const addItem = useCallback(
    (productId: string) => enqueue({ action: 'add', productId, quantity: 1 }),
    [enqueue],
  )
  const setQuantity = useCallback(
    (productId: string, quantity: number) =>
      enqueue({ action: 'set', productId, quantity: Math.max(0, quantity) }),
    [enqueue],
  )
  const removeItem = useCallback(
    (productId: string) => enqueue({ action: 'remove', productId }),
    [enqueue],
  )
  const clearCart = useCallback(() => enqueue({ action: 'clear' }), [enqueue])
  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0)
  const value = useMemo(
    () => ({
      items,
      itemCount,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      isSyncing: pending > 0,
      error,
    }),
    [items, itemCount, addItem, setQuantity, removeItem, clearCart, pending, error],
  )
  return (
    <CartContext.Provider value={value}>
      {error && (
        <div className="cart-sync-error" role="alert">
          {error}{' '}
          {failed && (
            <button className="text-action" disabled={pending > 0} onClick={() => enqueue(failed)}>
              Retry cart update
            </button>
          )}
        </div>
      )}
      {children}
    </CartContext.Provider>
  )
}
