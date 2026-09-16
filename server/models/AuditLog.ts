import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const auditLogSchema = new Schema({
  actorType: { type: String, enum: ['system', 'admin', 'stripe'], required: true },
  actorId: { type: String, default: null },
  action: { type: String, required: true, index: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true, index: true },
  before: { type: Schema.Types.Mixed, default: null },
  after: { type: Schema.Types.Mixed, default: null },
  correlationId: { type: String, default: null, index: true },
}, { timestamps: true })

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema> & { _id: mongoose.Types.ObjectId }
export const AuditLog = (mongoose.models.AuditLog as Model<AuditLogDocument>) || mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema)
