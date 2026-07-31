import { useAuthStore } from '@/store/auth'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = useAuthStore.getState()
  const headers = new Headers(init?.headers ?? {})
  if (!headers.get('content-type') && !(init?.body instanceof FormData)) {
    headers.set('content-type', 'application/json')
  }
  if (auth.token) headers.set('authorization', `Bearer ${auth.token}`)

  const res = await fetch(path, { ...init, headers })
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const { token, user } = useAuthStore.getState()
    if (token || user) {
      useAuthStore.setState({ token: null, user: null })
      try {
        localStorage.removeItem('party_school_mobile_auth')
      } catch {
        null
      }
    }
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) throw new Error(json?.error ?? '请求失败')
  return json.data as T
}
