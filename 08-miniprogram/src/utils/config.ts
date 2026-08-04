/** 本地默认 127.0.0.1：微信开发者工具里 localhost 经常连不上 */
export const API_BASE = (
  process.env.TARO_APP_API_BASE ||
  'http://127.0.0.1:3001'
).replace(/\/$/, '')

export function mediaUrl(path?: string | null) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith('/')) return `${API_BASE}${path}`
  return `${API_BASE}/${path}`
}
