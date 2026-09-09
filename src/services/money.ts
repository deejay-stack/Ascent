export const cents = (amount: number) => {
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000)
    throw new Error('Enter a valid non-negative amount.')
  return Math.round((amount + Number.EPSILON) * 100)
}
export const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
export function calculateTotals(
  lines: { price: number; quantity: number }[],
  discount = 0,
  taxRate = 0,
) {
  const subtotal = lines.reduce((sum, line) => sum + cents(line.price) * line.quantity, 0)
  const discountCents = cents(discount)
  if (discountCents > subtotal) throw new Error('Discount cannot exceed subtotal.')
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)
    throw new Error('Tax must be between 0 and 100%.')
  const tax = Math.round(((subtotal - discountCents) * taxRate) / 100)
  return {
    subtotal: subtotal / 100,
    discount: discountCents / 100,
    tax: tax / 100,
    total: (subtotal - discountCents + tax) / 100,
  }
}
