import { monitorEventLoopDelay } from 'node:perf_hooks'
import process from 'node:process'
import mongoose from 'mongoose'

type RouteMetric = { count: number; errors: number; durations: number[] }
type StripeMetric = { calls: number; errors: number; rateLimits: number; timeouts: number; durations: number[] }

const startedAt = Date.now()
const eventLoop = monitorEventLoopDelay({ resolution: 20 })
eventLoop.enable()
const routes = new Map<string, RouteMetric>()
const stripe: StripeMetric = { calls: 0, errors: 0, rateLimits: 0, timeouts: 0, durations: [] }
const MAX_SAMPLES = 2_000

function keep(values: number[], value: number) { values.push(value); if (values.length > MAX_SAMPLES) values.splice(0, values.length - MAX_SAMPLES) }
function percentile(values: number[], p: number) { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] }

export function recordRequest(method: string, path: string, status: number, durationMs: number) {
  const key = `${method} ${path}`
  const route = routes.get(key) ?? { count: 0, errors: 0, durations: [] }
  route.count += 1
  if (status >= 500) route.errors += 1
  keep(route.durations, durationMs)
  routes.set(key, route)
}

export async function instrumentStripe<T>(operation: string, work: () => Promise<T>): Promise<T> {
  const started = performance.now()
  try { return await work() }
  catch (error: any) {
    stripe.errors += 1
    if (error?.statusCode === 429 || error?.code === 'rate_limit') stripe.rateLimits += 1
    if (error?.code === 'ETIMEDOUT' || error?.type === 'StripeConnectionError') stripe.timeouts += 1
    throw error
  } finally {
    stripe.calls += 1
    keep(stripe.durations, performance.now() - started)
    void operation
  }
}

export function snapshotMetrics() {
  const memory = process.memoryUsage()
  return {
    collectedAt: new Date().toISOString(), uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    host: { cpuPercent: process.cpuUsage(), memory: { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal }, eventLoopDelayMs: { mean: Number(eventLoop.mean / 1e6) || 0, p95: Number(eventLoop.percentile(95) / 1e6) || 0, max: Number(eventLoop.max / 1e6) || 0 } },
    mongo: { readyState: mongoose.connection.readyState, configuredConnectionObjects: mongoose.connections.length, note: 'Atlas-wide connection count and Atlas errors are not available from a MongoDB driver connection; this is process-instance state.' },
    routes: Object.fromEntries([...routes].map(([route, value]) => [route, { count: value.count, errorRate: value.count ? value.errors / value.count : 0, p50: percentile(value.durations, .5), p95: percentile(value.durations, .95), p99: percentile(value.durations, .99) }])),
    stripe: { calls: stripe.calls, errors: stripe.errors, rateLimits: stripe.rateLimits, timeouts: stripe.timeouts, p50: percentile(stripe.durations, .5), p95: percentile(stripe.durations, .95), p99: percentile(stripe.durations, .99) },
  }
}

export function startMetricsHeartbeat() {
  return setInterval(() => console.log(JSON.stringify({ type: 'heartbeat', ...snapshotMetrics() })), 10_000)
}
