import { Order } from '../models/Order.js'
import { Reservation } from '../models/Reservation.js'
import { Product } from '../models/Product.js'
import { stripe } from './stripeClient.js'
import { broadcastStockUpdate } from './socket.js'

/** Reconcile pending rows with Stripe's server-side PaymentIntent state. */
export async function reconcilePendingPayments() {
  const pendingOrders = await Order.find({ status: 'pending' }).limit(100)
  for (const order of pendingOrders) {
    const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId)
    if (intent.status === 'succeeded') {
      const claimed = await Reservation.findOneAndUpdate(
        { _id: order.reservationId, status: 'pending' },
        { status: 'confirmed' },
        { new: true },
      )
      if (claimed) await Order.updateOne({ _id: order._id }, { status: 'succeeded' })
    } else if (intent.status === 'canceled') {
      const released = await Reservation.findOneAndUpdate(
        { _id: order.reservationId, status: 'pending' },
        { status: 'cancelled' },
        { new: true },
      )
      if (released) {
        const product = await Product.findByIdAndUpdate(released.productId, { $inc: { availableStock: released.quantity } }, { new: true })
        if (product) broadcastStockUpdate(product._id.toString(), product.availableStock)
        await Order.updateOne({ _id: order._id }, { status: 'cancelled' })
      }
    }
  }
}
