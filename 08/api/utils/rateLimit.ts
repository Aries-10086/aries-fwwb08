type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** 简易内存限流：windowMs 内最多 limit 次 */
export function hitRateLimit(key: string, limit: number, windowMs: number): {
  ok: boolean
  retryAfterSec: number
} {
  const now = Date.now()
  const cur = buckets.get(key)
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSec: 0 }
  }
  if (cur.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) }
  }
  cur.count += 1
  return { ok: true, retryAfterSec: 0 }
}

export function clientKey(req: { ip?: string; headers: Record<string, unknown> }, suffix: string) {
  const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim()
  return `${suffix}:${ip}`
}
