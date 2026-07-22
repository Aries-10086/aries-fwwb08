import { createHmac, timingSafeEqual, randomBytes } from 'crypto'

const SECRET =
  process.env.AUTH_SECRET ||
  // 开发默认值；生产务必设置 AUTH_SECRET
  'party-school-dev-secret-change-me'

export type TokenPayload = {
  sub: string
  iat: number
  exp: number
}

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf.toString('base64url')
}

function fromB64url(input: string) {
  return Buffer.from(input, 'base64url')
}

export function signAccessToken(userId: string, expiresInSec = 7 * 24 * 3600): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: TokenPayload = {
    sub: userId,
    iat: now,
    exp: now + expiresInSec,
  }
  const body = b64url(JSON.stringify(payload))
  const sig = b64url(createHmac('sha256', SECRET).update(body).digest())
  return `${body}.${sig}`
}

export function verifyAccessToken(token: string): TokenPayload | null {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null

  const expected = b64url(createHmac('sha256', SECRET).update(body).digest())
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as TokenPayload
    if (!payload?.sub || typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function extractBearerToken(req: { headers: Record<string, unknown> }): string {
  const raw = String(req.headers.authorization ?? req.headers.Authorization ?? '')
  if (raw.toLowerCase().startsWith('bearer ')) return raw.slice(7).trim()
  // 兼容旧客户端：不再信任 x-user-id 提权，但可带 token 头
  const alt = String(req.headers['x-access-token'] ?? '')
  return alt.trim()
}

export function randomPassword(length = 12): string {
  return randomBytes(length).toString('base64url').slice(0, length)
}
