import { Banknote, Landmark } from 'lucide-react'
import type { CheckoutMethod } from '../../services/checkout'
export function PaymentMark({ method }: { method: CheckoutMethod }) {
  return (
    <span className={'payment-mark payment-mark-' + method}>
      {method === 'cash' || method === 'cod' ? (
        <Banknote aria-hidden="true" />
      ) : method === 'qrph' ? (
        <Landmark aria-hidden="true" />
      ) : (
        <img src={'/images/payments/' + method + '.png'} alt="" aria-hidden="true" />
      )}
    </span>
  )
}
