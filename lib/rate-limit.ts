// In-memory per-IP rate limiter. 30 requests per 60-second window.
// Works in both local dev and Vercel serverless (per-instance, not globally coordinated).

interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

const WINDOW_MS = 60_000
const MAX_REQUESTS = 30

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || now >= entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { allowed: true }
}
