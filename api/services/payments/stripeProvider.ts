import { stripe } from '../stripeClient.js'
import type { PaymentProvider } from './types.js'

export const stripeProvider: PaymentProvider = {
  name: 'stripe',
  async createPayment({ amountCents, currency, idempotencyKey, metadata }) {
    // Card-only test bed: explicitly avoid redirect methods unless the application
    // also supplies and handles a return URL for each payment attempt.
    const intent = await stripe.paymentIntents.create({ amount: amountCents, currency, metadata, automatic_payment_methods: { enabled: true, allow_redirects: 'never' } }, { idempotencyKey })
    return { providerPaymentId: intent.id, clientSecret: intent.client_secret, status: 'pending' }
  },
  async retrievePayment(providerPaymentId) {
    const intent = await stripe.paymentIntents.retrieve(providerPaymentId)
    if (intent.status === 'succeeded') return { status: 'succeeded' }
    if (intent.status === 'canceled') return { status: 'cancelled' }
    return { status: 'pending' }
  },
  async refundPayment(providerPaymentId, amountCents) {
    const refund = await stripe.refunds.create({ payment_intent: providerPaymentId, ...(amountCents ? { amount: amountCents } : {}) })
    return { providerRefundId: refund.id, status: refund.status === 'succeeded' ? 'succeeded' : 'pending' }
  },
}
