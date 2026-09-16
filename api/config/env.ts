import dotenv from 'dotenv'

dotenv.config()

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

export const env = {
  port: parsePositiveNumber(process.env.PORT, 3001),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI ?? '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  adminApiKey: process.env.ADMIN_API_KEY ?? '',
  reservationHoldMinutes: parsePositiveNumber(process.env.RESERVATION_HOLD_MINUTES, 5),
  cleanupIntervalMs: parsePositiveNumber(process.env.CLEANUP_INTERVAL_MS, 15_000),
  currency: 'usd' as const,
}
