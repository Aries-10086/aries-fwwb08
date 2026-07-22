import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  try {
    const expected = Buffer.from(hash, 'hex')
    const actual = scryptSync(password, salt, 64)
    if (expected.length !== actual.length) return false
    return timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

export function normalizeUsername(username: string): string {
  return String(username ?? '')
    .trim()
    .toLowerCase()
}
