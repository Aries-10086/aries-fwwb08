import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const PREFIX = 'v1:'
const SALT = 'party-school-ai-settings-v1'

function deriveKey(): Buffer {
  const secret = String(process.env.AUTH_SECRET || process.env.SETTINGS_SECRET || '').trim()
  if (!secret || secret.length < 16) {
    throw new Error('缺少 AUTH_SECRET（至少 16 位），无法加解密 AI 密钥')
  }
  return scryptSync(secret, SALT, 32)
}

/** AES-256-GCM 加密；返回带版本前缀的密文，可安全入库 */
export function encryptSecret(plain: string): string {
  const value = String(plain ?? '')
  if (!value) return ''
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

export function decryptSecret(packed: string): string {
  const value = String(packed ?? '')
  if (!value) return ''
  if (!value.startsWith(PREFIX)) {
    throw new Error('密钥密文格式无效')
  }
  const buf = Buffer.from(value.slice(PREFIX.length), 'base64url')
  if (buf.length < 28) throw new Error('密钥密文损坏')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function maskSecret(value: string): string {
  const text = String(value ?? '')
  if (!text) return ''
  if (text.length <= 8) return '••••••••'
  return `${text.slice(0, 3)}••••${text.slice(-4)}`
}
