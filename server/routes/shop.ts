import { Router, type Request, type Response } from 'express'
import { Product } from '../models/Product.js'
import { Reservation } from '../models/Reservation.js'
import { stripe } from '../services/stripeClient.js'
import { env } from '../config/env.js'
import crypto from 'crypto'
import { Order } from '../models/Order.js'
import mongoose from 'mongoose'
import { stripeProvider } from '../services/payments/stripeProvider.js'
import { writeAudit } from '../services/audit.js'

const router = Router()

/**
 * GET /api/products
 * List all products with stock information
 */
router.get('/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 })
    res.json({ success: true, products })
  } catch (error) {
    console.error('Error fetching products:', error)
    res.status(500).json({ success: false, error: 'Internal Server Error' })
  }
})

/**
 * POST /api/checkout/reserve
 * Atomically reserve stock and create Stripe PaymentIntent
 */
const reserveCheckout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity } = req.body

    if (!productId || !quantity || typeof quantity !== 'number' || quantity < 1) {
      res.status(400).json({ success: false, error: 'Invalid productId or quantity' })
      return
    }

    // 1. Atomic Decrement Pattern
    // We only decrement availableStock if it is >= quantity.
    // This is the core invariant to prevent overselling.
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, availableStock: { $gte: quantity } },
      { $inc: { availableStock: -quantity } },
      { new: true }
    )

    if (!updatedProduct) {
      // The race condition was lost, or product is truly out of stock
      res.status(409).json({ success: false, error: 'Out of stock or insufficient quantity available' })
      return
    }

    // 2. Create Reservation
    const sessionId = req.headers['x-session-id'] as string || crypto.randomUUID()
    const expiresAt = new Date(Date.now() + env.reservationHoldMinutes * 60 * 1000)

    const reservation = await Reservation.create({
      productId,
      sessionId,
      quantity,
      status: 'pending',
      expiresAt,
    })

    // 3. Create Stripe PaymentIntent using server-computed amount
    const amountCents = updatedProduct.priceCents * quantity

    const paymentIntent = await stripeProvider.createPayment({
      amountCents,
      currency: env.currency,
      metadata: {
        reservationId: reservation._id.toString(),
        productId: productId.toString(),
        quantity: quantity.toString(),
      },
      idempotencyKey: `reserve_${reservation._id.toString()}`,
    })

    // Update reservation with the payment intent ID
    reservation.stripePaymentIntentId = paymentIntent.providerPaymentId
    await reservation.save()

    // 4. Create a pending Order
    await Order.create({
      productId,
      reservationId: reservation._id,
      quantity,
      amountCents,
      currency: env.currency,
      stripePaymentIntentId: paymentIntent.providerPaymentId,
      status: 'pending',
    })
    
    // Broadcast stock update
    import('../services/socket.js').then(({ broadcastStockUpdate }) => {
      broadcastStockUpdate(productId, updatedProduct.availableStock)
    })

    res.json({
      success: true,
      clientSecret: paymentIntent.clientSecret,
      reservationId: reservation._id,
      expiresAt,
      quantity,
      amountCents
    })
    void writeAudit({ actorType: 'system', action: 'reservation.created', entityType: 'reservation', entityId: reservation._id.toString(), after: { productId, quantity, status: 'pending' }, correlationId: paymentIntent.providerPaymentId })
  } catch (error) {
    console.error('Reservation error:', error)
    res.status(500).json({ success: false, error: 'Internal Server Error' })
  }
}

// Keep /reserve for the existing load-test script; the documented checkout path is canonical.
router.post('/reserve', reserveCheckout)
router.post('/checkout/reserve', reserveCheckout)

/**
 * GET /api/orders/:id
 * Poll order status
 */
router.get('/orders/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    // Search by reservationId or orderId, depending on what client has
    const order = await Order.findOne({ 
      $or: [
        { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null },
        { reservationId: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }
      ]
    }).populate('productId', 'name imageUrl')
    
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' })
      return
    }
    
    res.json({ success: true, order })
  } catch (error) {
    console.error('Error fetching order:', error)
    res.status(500).json({ success: false, error: 'Internal Server Error' })
  }
})

/**
 * POST /api/orders/:id/reconcile
 * Elements calls this after a local confirmation. We retrieve the PaymentIntent with
 * our secret key rather than trusting the browser, giving the UI an immediate result
 * while the signed Stripe webhook remains the durable reconciliation backstop.
 */
router.post('/orders/:id/reconcile', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ success: false, error: 'Invalid order reference' })
      return
    }
    const order = await Order.findOne({ $or: [{ _id: req.params.id }, { reservationId: req.params.id }] })
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' })
      return
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId)
    if (paymentIntent.status === 'succeeded') {
      // Transition only a pending reservation. If a webhook won this race, this is a no-op.
      const confirmed = await Reservation.findOneAndUpdate(
        { _id: order.reservationId, status: 'pending' },
        { status: 'confirmed' },
        { new: true },
      )
      if (confirmed) await Order.updateOne({ _id: order._id }, { status: 'succeeded' })
    } else if (paymentIntent.status === 'canceled') {
      const released = await Reservation.findOneAndUpdate(
        { _id: order.reservationId, status: 'pending' },
        { status: 'cancelled' },
        { new: true },
      )
      if (released) {
        const product = await Product.findByIdAndUpdate(released.productId, { $inc: { availableStock: released.quantity } }, { new: true })
        if (product) import('../services/socket.js').then(({ broadcastStockUpdate }) => broadcastStockUpdate(product._id.toString(), product.availableStock))
        await Order.updateOne({ _id: order._id }, { status: 'cancelled' })
      }
    }

    const refreshed = await Order.findById(order._id)
    const reservation = await Reservation.findById(order.reservationId)
    res.json({ success: true, order: refreshed, reservation })
  } catch (error) {
    console.error('Payment reconciliation error:', error)
    res.status(500).json({ success: false, error: 'Could not reconcile payment status' })
  }
})

export default router
