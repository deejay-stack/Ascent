import { getState, id, mutate, requireOperator } from '../mockStore'
import { cents } from '../money'
import type { InventoryService } from './inventoryService'
export const mockInventoryService: InventoryService = {
  list(actor) {
    requireOperator(actor)
    return getState().products.map(p => { if (actor.role === 'owner') return {...p}; const {costPrice,...rest}=p; void costPrice; return rest })
  },
  movements(actor) { requireOperator(actor); return getState().movements.toReversed() },
  async adjust(input) {
    requireOperator(input.actor)
    if (!input.reason.trim()) throw new Error('An adjustment reason is required.')
    if (!Number.isSafeInteger(input.quantity) || input.quantity < (input.type === 'adjustment' ? 0 : 1)) throw new Error('Enter a valid whole quantity.')
    mutate(draft => {
      const p = draft.products.find(p => p.id === input.productId)
      if (!p) throw new Error('Product not found.')
      const before = p.stockQuantity
      const after = input.type === 'adjustment' ? input.quantity : before + input.quantity * (input.type === 'stock-in' ? 1 : -1)
      if (after < 0) throw new Error('Stock-out exceeds available stock.')
      if (after === before) throw new Error('Enter a quantity that changes stock.')
      p.stockQuantity = after
      p.updatedAt = new Date().toISOString()
      draft.movements.push({id:id('MOV'),productId:p.id,productName:p.name,type:input.type,quantity:after-before,before,after,reason:input.reason.trim(),responsibleUser:input.actor.name,createdAt:p.updatedAt})
    })
  },
  async updateProduct(productId, fields, actor) {
    if (actor.role !== 'owner') throw new Error('Only the owner can edit products.')
    if (!fields.name.trim()) throw new Error('Product name is required.')
    cents(fields.sellingPrice); cents(fields.costPrice)
    if (!Number.isSafeInteger(fields.lowStockThreshold) || fields.lowStockThreshold < 0) throw new Error('Threshold must be a non-negative whole number.')
    mutate(draft => {
      const p = draft.products.find(p=>p.id===productId)
      if (!p) throw new Error('Product not found.')
      Object.assign(p,fields,{name:fields.name.trim(),updatedAt:new Date().toISOString()})
    })
  },
}

