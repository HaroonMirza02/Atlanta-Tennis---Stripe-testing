import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const reservationSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'expired', 'cancelled', 'failed'],
      required: true,
      default: 'pending',
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

reservationSchema.index({ status: 1, expiresAt: 1 })

export type ReservationDocument = InferSchemaType<typeof reservationSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Reservation = (mongoose.models.Reservation as Model<ReservationDocument>) || mongoose.model<ReservationDocument>('Reservation', reservationSchema)
