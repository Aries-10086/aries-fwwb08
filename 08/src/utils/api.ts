import { useAuthStore } from '@/store/auth'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = useAuthStore.getState()
  const headers = new Headers(init?.headers ?? {})
  if (!headers.get('content-type') && !(init?.body instanceof FormData)) {
    headers.set('content-type', 'application/json')
  }
  // 仅发送服务端签发的 Bearer token；不再发送可伪造的 x-role
  if (auth.token) headers.set('authorization', `Bearer ${auth.token}`)

  const res = await fetch(path, { ...init, headers })
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    // token 失效时清理本地登录态（避免 logout 自身递归）
    const { token, user } = useAuthStore.getState()
    if (token || user) {
      useAuthStore.setState({ token: null, user: null })
      try {
        localStorage.removeItem('party_school_auth')
      } catch {
        null
      }
    }
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) throw new Error(json?.error ?? '请求失败')
  return json.data as T
}

export async function apiUpload<T>(path: string, file: File, fieldName = 'file'): Promise<T> {
  const form = new FormData()
  form.append(fieldName, file)
  return apiFetch<T>(path, { method: 'POST', body: form })
}
