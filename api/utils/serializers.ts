import type { OrderStatusResponse, ProductDto } from '../../shared/contracts.js'
import type { OrderDocument } from '../models/Order.js'
import type { ProductDocument } from '../models/Product.js'
import type { ReservationDocument } from '../models/Reservation.js'

export function toProductDto(product: ProductDocument): ProductDto {
  return {
    id: product._id.toString(),
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    priceCents: product.priceCents,
    currency: product.currency,
    totalStock: product.totalStock,
    availableStock: product.availableStock,
    isOutOfStock: product.availableStock <= 0,
  }
}

export function toOrderStatusResponse(
  order: OrderDocument,
  reservation: ReservationDocument,
): OrderStatusResponse {
  return {
    id: order._id.toString(),
    status: order.status,
    reservationStatus: reservation.status,
    productId: order.productId.toString(),
    quantity: order.quantity,
    amountCents: order.amountCents,
    currency: order.currency,
    paymentIntentId: order.stripePaymentIntentId,
    webhookEventIds: order.webhookEventIds,
    expiresAt: reservation.expiresAt?.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  }
}
