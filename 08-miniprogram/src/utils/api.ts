import Taro from '@tarojs/taro'
import { useAuthStore } from '@/store/auth'
import { API_BASE } from '@/utils/config'

type RequestInitLike = {
  method?: string
  body?: string
  header?: Record<string, string>
}

export async function apiFetch<T>(path: string, init?: RequestInitLike): Promise<T> {
  const auth = useAuthStore.getState()
  const header: Record<string, string> = {
    'content-type': 'application/json',
    ...(init?.header ?? {}),
  }
  if (auth.token) header.authorization = `Bearer ${auth.token}`

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const method = (init?.method || 'GET').toUpperCase() as
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'DELETE'
    | 'PATCH'
  const res = await Taro.request({
    url,
    method,
    data: init?.body ? JSON.parse(init.body) : undefined,
    header,
  })

  if (res.statusCode === 401 && !path.startsWith('/api/auth/')) {
    const { token, user } = useAuthStore.getState()
    if (token || user) {
      useAuthStore.getState().clearLocal()
    }
  }

  const json = (res.data ?? {}) as { success?: boolean; data?: T; error?: string }
  if (res.statusCode >= 400 || !json?.success) {
    throw new Error(json?.error ?? '请求失败')
  }
  return json.data as T
}
