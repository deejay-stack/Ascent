import type { Payment, PaymentMethod } from '../../types/commerce'
export interface PaymentService {
  begin(
    transactionId: string,
    method: Exclude<PaymentMethod, 'cash'>,
    total: number,
  ): Promise<Payment>
  simulate(id: string, outcome: 'succeeded' | 'failed' | 'cancelled'): Promise<Payment>
  verify(id: string, transactionId: string, method: PaymentMethod, total: number): boolean
}
