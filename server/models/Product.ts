import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    priceCents: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ['usd'],
      default: 'usd',
      required: true,
    },
    totalStock: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },
    availableStock: {
      type: Number,
      required: true,
      min: 0,
    },
    version: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
)

export type ProductDocument = InferSchemaType<typeof productSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Product = (mongoose.models.Product as Model<ProductDocument>) || mongoose.model<ProductDocument>('Product', productSchema)
