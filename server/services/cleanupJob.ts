import { Reservation } from '../models/Reservation.js'
import { Product } from '../models/Product.js'
import { Order } from '../models/Order.js'
import { env } from '../config/env.js'
import { stripe } from './stripeClient.js'
import { reconcilePendingPayments } from './paymentReconciliation.js'

let intervalId: NodeJS.Timeout | null = null

export function startCleanupJob() {
  if (intervalId) return

  // Reconcile immediately on boot, then continue on the normal cleanup cadence.
  void reconcilePendingPayments().catch((error) => console.error('Initial payment reconciliation error:', error))

  intervalId = setInterval(async () => {
    try {
      // A webhook is the normal fast path. This server-side Stripe read repairs a
      // missed/delayed webhook after a restart or local Stripe CLI interruption.
      await reconcilePendingPayments()
      const now = new Date()
      // Find pending reservations that have expired
      const expiredReservations = await Reservation.find({
        status: 'pending',
        expiresAt: { $lt: now }
      })

      for (const res of expiredReservations) {
        // Claim the pending hold first. Webhook processing can race this worker;
        // only one state transition is allowed to release the stock.
        const claimed = await Reservation.findOneAndUpdate(
          { _id: res._id, status: 'pending', expiresAt: { $lt: now } },
          { status: 'expired' },
          { new: true },
        )
        if (!claimed) continue

        // Release the reserved stock back
        const updatedProduct = await Product.findByIdAndUpdate(claimed.productId, {
          $inc: { availableStock: claimed.quantity }
        }, { new: true })

        // Also mark the associated order as cancelled
        await Order.findOneAndUpdate(
          { reservationId: claimed._id },
          { status: 'cancelled' }
        )
        
        if (updatedProduct) {
          import('./socket.js').then(({ broadcastStockUpdate }) => {
            broadcastStockUpdate(updatedProduct._id.toString(), updatedProduct.availableStock)
          })
        }

        // Cancel the Stripe PaymentIntent if it exists and is cancellable
        if (claimed.stripePaymentIntentId) {
          try {
            const pi = await stripe.paymentIntents.retrieve(claimed.stripePaymentIntentId)
            if (pi.status === 'requires_payment_method' || pi.status === 'requires_confirmation' || pi.status === 'requires_action' || pi.status === 'requires_capture') {
              await stripe.paymentIntents.cancel(claimed.stripePaymentIntentId)
            }
          } catch (stripeErr) {
            console.error(`Failed to cancel Stripe PI ${res.stripePaymentIntentId}:`, stripeErr)
          }
        }

        console.log(`Cleaned up expired reservation ${claimed._id}, released ${claimed.quantity} stock.`)
      }
    } catch (error) {
      console.error('Cleanup job error:', error)
    }
  }, env.cleanupIntervalMs)

  console.log(`Cleanup job started, running every ${env.cleanupIntervalMs}ms`)
}

export function stopCleanupJob() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('Cleanup job stopped')
  }
}
