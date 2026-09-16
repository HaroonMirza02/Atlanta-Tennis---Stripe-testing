import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const orderSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true,
      unique: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    amountCents: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ['usd'],
      required: true,
      default: 'usd',
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
      unique: true,
    },
    // `pending` is an internal pre-webhook state so the frontend can poll until Stripe
    // sends a terminal event. Final business outcomes remain the statuses requested in the brief.
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded', 'cancelled', 'disputed'],
      required: true,
      default: 'pending',
      index: true,
    },
    webhookEventIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
)

export type OrderDocument = InferSchemaType<typeof orderSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Order = (mongoose.models.Order as Model<OrderDocument>) || mongoose.model<OrderDocument>('Order', orderSchema)
