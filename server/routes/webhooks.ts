import { Router, type Request, type Response } from 'express'
import { stripe } from '../services/stripeClient.js'
import { env } from '../config/env.js'
import { Order } from '../models/Order.js'
import { Reservation } from '../models/Reservation.js'
import { Product } from '../models/Product.js'
import { writeAudit } from '../services/audit.js'

const router = Router()

/**
 * POST /api/webhooks/stripe
 * Stripe webhook endpoint
 */
router.post('/stripe', async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string
  let event

  try {
    if (env.stripeWebhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, env.stripeWebhookSecret)
    } else {
      // If no webhook secret is configured (e.g., initial local dev without stripe listen),
      // we can attempt to parse it without signature validation, but in a real scenario
      // this should be rejected. The instructions say we MUST verify the signature.
      // So if missing secret, we fail.
      throw new Error('Missing stripe webhook secret in environment')
    }
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`)
    res.status(400).send(`Webhook Error: ${err.message}`)
    return
  }

  // Idempotency: Check if we've already processed this event
  try {
    // We only process payment events relevant to a local order.
    if (event.type === 'payment_intent.succeeded' || 
        event.type === 'payment_intent.payment_failed' || 
        event.type === 'payment_intent.canceled' ||
        event.type === 'charge.refunded' ||
        event.type === 'charge.dispute.created' ||
        event.type === 'charge.dispute.closed') {
      
      const stripeObject = event.data.object as any
      const paymentIntentId = event.type.startsWith('payment_intent.') ? stripeObject.id : stripeObject.payment_intent
      if (!paymentIntentId) { res.json({ received: true }); return }
      // Claim this event atomically. A read-then-push check can race when Stripe
      // redelivers in parallel; the query guard makes a duplicate a true no-op.
      const order = await Order.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntentId, webhookEventIds: { $ne: event.id } },
        { $addToSet: { webhookEventIds: event.id } },
        { new: true },
      )

      if (!order) {
        const knownOrder = await Order.exists({ stripePaymentIntentId: paymentIntentId })
        if (!knownOrder) console.warn(`Order not found for PaymentIntent ${paymentIntentId}`)
        else console.log(`Webhook event ${event.id} already processed. Ignoring.`)
        res.json({ received: true })
        return
      }

      if (event.type === 'payment_intent.succeeded') {
        order.status = 'succeeded'
        await Reservation.findOneAndUpdate({ _id: order.reservationId, status: 'pending' }, { status: 'confirmed' })
        
        // Stock remains permanently decremented
        void writeAudit({ actorType: 'stripe', action: 'payment.succeeded', entityType: 'order', entityId: order._id.toString(), after: { status: 'succeeded' }, correlationId: event.id })
      } else if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
        order.status = 'failed'
        // Only the transition out of pending owns the release. This prevents a
        // later terminal Stripe event from returning the same units twice.
        const reservation = await Reservation.findOneAndUpdate(
          { _id: order.reservationId, status: 'pending' },
          { status: event.type === 'payment_intent.canceled' ? 'cancelled' : 'failed' },
          { new: true },
        )
        
        if (reservation) {
          // Release reserved stock back
          const updatedProduct = await Product.findByIdAndUpdate(reservation.productId, {
            $inc: { availableStock: reservation.quantity }
          }, { new: true })
          console.log(`Released ${reservation.quantity} stock for product ${reservation.productId}`)
          
          if (updatedProduct) {
            import('../services/socket.js').then(({ broadcastStockUpdate }) => {
              broadcastStockUpdate(updatedProduct._id.toString(), updatedProduct.availableStock)
            })
          }
        }
        void writeAudit({ actorType: 'stripe', action: 'payment.failed_or_cancelled', entityType: 'order', entityId: order._id.toString(), after: { status: order.status }, correlationId: event.id })
      } else if (event.type === 'charge.refunded') {
        order.status = 'refunded'
        void writeAudit({ actorType: 'stripe', action: 'payment.refunded', entityType: 'order', entityId: order._id.toString(), after: { status: 'refunded' }, correlationId: event.id })
      } else if (event.type === 'charge.dispute.created') {
        order.status = 'disputed'
        void writeAudit({ actorType: 'stripe', action: 'payment.disputed', entityType: 'order', entityId: order._id.toString(), after: { status: 'disputed', disputeId: stripeObject.id }, correlationId: event.id })
      } else if (event.type === 'charge.dispute.closed') {
        // The final outcome needs an operations review; preserve the audit event.
        void writeAudit({ actorType: 'stripe', action: 'payment.dispute_closed', entityType: 'order', entityId: order._id.toString(), after: { disputeId: stripeObject.id, outcome: stripeObject.status }, correlationId: event.id })
      }

      await order.save()
    }

    res.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    res.status(500).send('Webhook handler failed')
  }
})

export default router
