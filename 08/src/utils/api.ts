import { useAuthStore } from '@/store/auth'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = useAuthStore.getState()
  const headers = new Headers(init?.headers ?? {})
  if (!headers.get('content-type')) headers.set('content-type', 'application/json')
  if (auth.user?.id) headers.set('x-user-id', auth.user.id)
  if (auth.user?.role) headers.set('x-role', auth.user.role)
  if (auth.user?.orgUnitId) headers.set('x-org-unit-id', auth.user.orgUnitId)

  const res = await fetch(path, { ...init, headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) throw new Error(json?.error ?? '请求失败')
  return json.data as T
}

