import { useAuthStore } from '@/store/auth'

export interface SSEMessage<T = unknown> {
  event: string
  data: T
  id?: string
}

export interface PostSSEOptions {
  body?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
  onEvent: (message: SSEMessage) => void
}

function clearExpiredLogin() {
  const { token, user } = useAuthStore.getState()
  if (!token && !user) return
  useAuthStore.setState({ token: null, user: null })
  try {
    localStorage.removeItem('party_school_auth')
  } catch {
    // 存储不可用时，内存登录态已清除
  }
}

function decodeData(raw: string): unknown {
  if (!raw) return ''
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export async function postSSE(path: string, options: PostSSEOptions): Promise<void> {
  const headers = new Headers(options.headers)
  headers.set('accept', 'text/event-stream')
  if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  const token = useAuthStore.getState().token
  if (token) headers.set('authorization', `Bearer ${token}`)

  const response = await fetch(path, {
    method: 'POST',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })

  if (response.status === 401 && !path.startsWith('/api/auth/')) clearExpiredLogin()
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error ?? `请求失败（${response.status}）`)
  }
  if (!response.body) throw new Error('浏览器不支持流式响应')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const emit = (block: string) => {
    let event = 'message'
    let id: string | undefined
    const data: string[] = []
    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(':')) continue
      const separator = line.indexOf(':')
      const field = separator < 0 ? line : line.slice(0, separator)
      let value = separator < 0 ? '' : line.slice(separator + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') event = value || 'message'
      if (field === 'id') id = value
      if (field === 'data') data.push(value)
    }
    if (data.length) options.onEvent({ event, data: decodeData(data.join('\n')), id })
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let boundary = buffer.match(/\r?\n\r?\n/)
      while (boundary?.index !== undefined) {
        emit(buffer.slice(0, boundary.index))
        buffer = buffer.slice(boundary.index + boundary[0].length)
        boundary = buffer.match(/\r?\n\r?\n/)
      }
      if (done) break
    }
    if (buffer.trim()) emit(buffer)
  } finally {
    reader.releaseLock()
  }
}
