/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import shopRoutes from './routes/shop.js'
import adminRoutes from './routes/admin.js'
import { recordRequest, snapshotMetrics } from './services/metrics.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use((req, res, next) => {
  const started = performance.now()
  res.on('finish', () => {
    const durationMs = performance.now() - started
    recordRequest(req.method, req.path, res.statusCode, durationMs)
    console.log(JSON.stringify({ type: 'request', method: req.method, path: req.path, status: res.statusCode, durationMs, touchedStripe: Boolean(res.getHeader('x-observability-stripe')), touchedMongo: Boolean(res.getHeader('x-observability-mongo')) }))
  })
  next()
})

app.use(cors())

// Use raw body for Stripe Webhooks before parsing JSON
import webhookRoutes from './routes/webhooks.js'
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.get('/api/metrics', (_req, res) => res.json({ success: true, metrics: snapshotMetrics() }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api', shopRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
