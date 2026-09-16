import { stripe } from '../stripeClient.js'
import type { PaymentProvider } from './types.js'

export const stripeProvider: PaymentProvider = {
  name: 'stripe',
  async createPayment({ amountCents, currency, idempotencyKey, metadata }) {
    const intent = await stripe.paymentIntents.create({ amount: amountCents, currency, metadata }, { idempotencyKey })
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
