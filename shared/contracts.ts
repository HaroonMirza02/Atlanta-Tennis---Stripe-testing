export type CurrencyCode = 'usd'

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'expired'
  | 'cancelled'
  | 'failed'

export type OrderStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'cancelled'
  | 'disputed'

export type ProductDto = {
  id: string
  name: string
  description: string
  imageUrl: string
  priceCents: number
  currency: CurrencyCode
  totalStock: number
  availableStock: number
  isOutOfStock: boolean
}

export type ReserveCheckoutRequest = {
  productId: string
  quantity: number
  sessionId?: string
}

export type ReserveCheckoutResponse = {
  reservationId: string
  orderId: string
  clientSecret: string
  paymentIntentId: string
  expiresAt: string
  holdMinutes: number
  product: ProductDto
}

export type ApiErrorResponse = {
  error: string
  message: string
}

export type OrderStatusResponse = {
  id: string
  status: OrderStatus
  reservationStatus: ReservationStatus
  productId: string
  quantity: number
  amountCents: number
  currency: CurrencyCode
  paymentIntentId: string
  webhookEventIds: string[]
  expiresAt?: string
  updatedAt: string
}

export type StockUpdateEvent = {
  product: ProductDto
  reason: 'reserved' | 'released' | 'confirmed' | 'seeded'
}
