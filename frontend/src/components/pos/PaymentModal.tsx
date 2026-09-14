import { CreditCard, QrCode } from 'lucide-react'
import { useState } from 'react'
import type { Payment } from '../../types/commerce'
import { paymentService } from '../../services'
import { money } from '../../services/money'
import { Modal } from '../ui/Modal'
export function PaymentModal({
  payment,
  onSuccess,
  onClose,
}: {
  payment: Payment
  onSuccess: (id: string) => Promise<void>
  onClose: () => void
}) {
  const [status, setStatus] = useState('pending')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const finish = async (outcome: 'succeeded' | 'failed' | 'cancelled') => {
    if (busy) return
    setBusy(true)
    try {
      await paymentService.simulate(payment.id, outcome)
      setStatus(outcome)
      if (outcome === 'succeeded') await onSuccess(payment.id)
      else if (outcome === 'cancelled') onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be completed.')
    } finally {
      setBusy(false)
    }
  }
  const close = () => {
    if (!busy) {
      if (status === 'pending') void finish('cancelled')
      else onClose()
    }
  }
  return (
    <Modal title={`${payment.method.toUpperCase()} payment demonstration`} onClose={close}>
      <div className="payment-demo">
        <p>No real payment will be taken.</p>
        {payment.method === 'card' ? (
          <CreditCard size={108} strokeWidth={1} />
        ) : (
          <QrCode size={144} strokeWidth={1} />
        )}
        <small>Non-scannable placeholder</small>
        <strong className="payment-total">{money(payment.total)}</strong>
        <code>{payment.transactionId}</code>
        <p role="status">
          {status === 'pending'
            ? 'Pending payment confirmation'
            : status === 'failed'
              ? 'Payment failed. Your bill is kept for retry.'
              : 'Payment confirmed'}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="action-row">
          {status === 'pending' && (
            <>
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => void finish('succeeded')}
              >
                Simulate Successful Payment
              </button>
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => void finish('failed')}
              >
                Simulate Failed Payment
              </button>
            </>
          )}
          <button className="button button-secondary" disabled={busy} onClick={close}>
            {status === 'pending' ? 'Cancel Payment' : 'Return to bill'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
