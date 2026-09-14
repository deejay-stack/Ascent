import type { AuthUser } from '../../types/auth'
import type { Sale } from '../../types/commerce'
import { getState, requireOperator } from '../mockStore'
import { cents } from '../money'
export const localDay = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
export type ReportFilter = { from?: string; to?: string; payment?: string; source?: string }
export function summarize(
  sales: Sale[],
  products = getState().products,
  categories = getState().categories,
) {
  const revenue = sales.reduce((sum, s) => sum + cents(s.total), 0) / 100
  const performance = products
    .map((p) => {
      const lines = sales.flatMap((s) => s.items).filter((l) => l.productId === p.id)
      return {
        id: p.id,
        name: p.name,
        quantity: lines.reduce((sum, l) => sum + l.quantity, 0),
        revenue: lines.reduce((sum, l) => sum + cents(l.total), 0) / 100,
      }
    })
    .sort((a, b) => b.quantity - a.quantity)
  const categoryPerformance = categories.map((c) => ({
    name: c.name,
    value:
      sales
        .flatMap((s) => s.items)
        .filter((l) => l.categoryId === c.id)
        .reduce((sum, l) => sum + cents(l.total), 0) / 100,
  }))
  const days = [...new Set(sales.map((s) => localDay(s.createdAt)))].sort()
  const trend = days.map((day) => ({
    name: day,
    value:
      sales
        .filter((s) => localDay(s.createdAt) === day)
        .reduce((sum, s) => sum + cents(s.total), 0) / 100,
  }))
  const active = products.filter((p) => !p.isArchived)
  return {
    revenue,
    transactions: sales.length,
    average: sales.length ? revenue / sales.length : 0,
    products: active.length,
    lowStock: active.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold)
      .length,
    outOfStock: active.filter((p) => p.stockQuantity === 0).length,
    performance,
    categoryPerformance,
    trend,
  }
}
export const reportService = {
  get(actor: AuthUser, filter: ReportFilter = {}) {
    requireOperator(actor)
    const sales = getState()
      .sales.filter(
        (s) =>
          (!filter.from || localDay(s.createdAt) >= filter.from) &&
          (!filter.to || localDay(s.createdAt) <= filter.to) &&
          (!filter.payment || s.paymentMethod === filter.payment) &&
          (!filter.source || s.source === filter.source),
      )
      .toReversed()
    return { ...summarize(sales), sales }
  },
}
