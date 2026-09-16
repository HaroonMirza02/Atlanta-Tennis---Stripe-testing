export type ProviderPaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'disputed'
export type PaymentProvider = {
  name: string
  createPayment(input: { amountCents: number; currency: 'usd'; idempotencyKey: string; metadata: Record<string, string> }): Promise<{ providerPaymentId: string; clientSecret: string | null; status: ProviderPaymentStatus }>
  retrievePayment(providerPaymentId: string): Promise<{ status: ProviderPaymentStatus }>
  refundPayment(providerPaymentId: string, amountCents?: number): Promise<{ providerRefundId: string; status: 'succeeded' | 'pending' }>
}
