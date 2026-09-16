import { Router, type Request, type Response, type NextFunction } from 'express'
import mongoose from 'mongoose'
import { Product } from '../models/Product.js'
import { Order } from '../models/Order.js'
import { Reservation } from '../models/Reservation.js'
import { env } from '../config/env.js'
import { broadcastStockUpdate } from '../services/socket.js'
import { reconcilePendingPayments } from '../services/paymentReconciliation.js'
import { stripeProvider } from '../services/payments/stripeProvider.js'
import { writeAudit } from '../services/audit.js'

const router = Router()

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // A real deployment must set ADMIN_API_KEY and put this behind staff authentication.
  // Leaving it unset only keeps the local demo frictionless; it is not a production default.
  if (env.adminApiKey && req.header('x-admin-key') !== env.adminApiKey) {
    res.status(401).json({ success: false, error: 'Admin authorization required' })
    return
  }
  next()
}

router.use(requireAdmin)

router.get('/overview', async (_req: Request, res: Response) => {
  // Make an operator refresh an immediate, server-verified reconciliation point.
  await reconcilePendingPayments()
  const [products, orderCounts, reservations, revenue] = await Promise.all([
    Product.find({}).sort({ name: 1 }).lean(),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Reservation.countDocuments({ status: 'pending' }),
    Order.aggregate([{ $match: { status: 'succeeded' } }, { $group: { _id: null, total: { $sum: '$amountCents' } } }]),
  ])
  res.json({
    success: true,
    products,
    metrics: {
      totalProducts: products.length,
      availableUnits: products.reduce((sum, product) => sum + product.availableStock, 0),
      outOfStock: products.filter((product) => product.availableStock === 0).length,
      pendingReservations: reservations,
      revenueCents: revenue[0]?.total ?? 0,
      orders: Object.fromEntries(orderCounts.map((item) => [item._id, item.count])),
    },
  })
})

router.get('/orders', async (_req: Request, res: Response) => {
  const orders = await Order.find({}).sort({ updatedAt: -1 }).limit(100).populate('productId', 'name imageUrl').lean()
  res.json({ success: true, orders })
})

router.get('/audit', async (_req: Request, res: Response) => {
  const { AuditLog } = await import('../models/AuditLog.js')
  const records = await AuditLog.find({}).sort({ createdAt: -1 }).limit(100).lean()
  res.json({ success: true, records })
})

router.post('/orders/:id/refund', async (req: Request, res: Response): Promise<void> => {
  const amountCents = req.body.amountCents === undefined ? undefined : Number(req.body.amountCents)
  if (!mongoose.isValidObjectId(req.params.id) || (amountCents !== undefined && (!Number.isInteger(amountCents) || amountCents <= 0))) {
    res.status(400).json({ success: false, error: 'Invalid order ID or refund amount.' })
    return
  }
  const order = await Order.findById(req.params.id)
  if (!order || order.status !== 'succeeded') {
    res.status(409).json({ success: false, error: 'Only succeeded orders can be refunded.' })
    return
  }
  if (amountCents && amountCents > order.amountCents) {
    res.status(400).json({ success: false, error: 'Refund cannot exceed the captured amount.' })
    return
  }
  const refund = await stripeProvider.refundPayment(order.stripePaymentIntentId, amountCents)
  // Stripe’s refund webhook is the final source of truth; show it as pending until then.
  void writeAudit({ actorType: 'admin', actorId: 'admin-api-key', action: 'refund.requested', entityType: 'order', entityId: order._id.toString(), before: { status: order.status }, after: { amountCents: amountCents ?? order.amountCents, providerRefundId: refund.providerRefundId }, correlationId: refund.providerRefundId })
  res.status(202).json({ success: true, refund })
})

router.patch('/products/:id/stock', async (req: Request, res: Response): Promise<void> => {
  const availableStock = Number(req.body.availableStock)
  if (!Number.isInteger(availableStock) || availableStock < 0 || availableStock > 5 || !mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Stock must be an integer from 0 to 5.' })
    return
  }

  const heldUnits = await Reservation.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(req.params.id), status: 'pending' } },
    { $group: { _id: null, quantity: { $sum: '$quantity' } } },
  ])
  const pendingQuantity = heldUnits[0]?.quantity ?? 0
  // This adjusts only currently sellable stock. Pending holds consume capacity too,
  // so a staff adjustment cannot silently turn held + sellable units above the five-unit test cap.
  if (availableStock + pendingQuantity > 5) {
    res.status(409).json({ success: false, error: `There are ${pendingQuantity} unit(s) currently held; sellable stock may not exceed ${5 - pendingQuantity}.` })
    return
  }

  // totalStock remains the immutable seed baseline, so reconciliation and reservations
  // never depend on a mutable display value.
  const beforeProduct = await Product.findById(req.params.id).lean()
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: { availableStock }, $inc: { version: 1 } },
    { new: true, runValidators: true },
  )
  if (!product) {
    res.status(404).json({ success: false, error: 'Product not found' })
    return
  }
  broadcastStockUpdate(product._id.toString(), product.availableStock)
  void writeAudit({ actorType: 'admin', actorId: 'admin-api-key', action: 'inventory.adjusted', entityType: 'product', entityId: product._id.toString(), before: { availableStock: beforeProduct?.availableStock }, after: { availableStock }, correlationId: null })
  res.json({ success: true, product })
})

export default router
