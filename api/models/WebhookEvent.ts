import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const webhookEventSchema = new Schema(
  {
    stripeEventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  },
)

export type WebhookEventDocument = InferSchemaType<typeof webhookEventSchema> & {
  _id: mongoose.Types.ObjectId
}

export const WebhookEvent =
  mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', webhookEventSchema)
