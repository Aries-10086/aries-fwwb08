import { useSyncExternalStore } from 'react'
import Taro from '@tarojs/taro'
import { API_BASE } from '@/utils/config'

export type UserRole = 'member' | 'secretary' | 'admin'

export type AuthUser = {
  id: string
  name: string
  username: string
  role: UserRole
  orgUnitId: string
}

type AuthState = {
  token: string | null
  user: AuthUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearLocal: () => void
}

const STORAGE_KEY = 'party_school_mp_auth'

function loadInitial(): Pick<AuthState, 'token' | 'user'> {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    if (!raw) return { token: null, user: null }
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return { token: parsed.token ?? null, user: parsed.user ?? null }
  } catch {
    return { token: null, user: null }
  }
}

function save(token: string | null, user: AuthUser | null) {
  try {
    if (!token || !user) {
      Taro.removeStorageSync(STORAGE_KEY)
      return
    }
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify({ token, user }))
  } catch {
    return
  }
}

let data = loadInitial()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function clearLocal() {
  data = { token: null, user: null }
  save(null, null)
  notify()
}

async function login(username: string, password: string) {
  if (!username || !password) {
    throw new Error('请您输入账号和密码')
  }
  let res: Awaited<ReturnType<typeof Taro.request>>
  try {
    res = await Taro.request({
      url: `${API_BASE}/api/auth/login`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { username, password },
      timeout: 15000,
    })
  } catch (err: any) {
    const msg = String(err?.errMsg || err?.message || '')
    if (msg.includes('url not in domain') || msg.includes('不在以下')) {
      throw new Error('请在开发者工具勾选「不校验合法域名」')
    }
    throw new Error(`暂时无法连接服务器（${API_BASE}），请您确认后端已启动后重试`)
  }
  const json = (res.data ?? {}) as {
    success?: boolean
    error?: string
    data?: { token: string; user: AuthUser }
  }
  if (res.statusCode >= 400 || !json?.success || !json?.data?.user || !json?.data?.token) {
    throw new Error(json?.error ?? `登录未成功（HTTP ${res.statusCode}），请您稍后重试`)
  }
  const { token, user } = json.data
  data = { token, user }
  save(token, user)
  notify()
}

async function logout() {
  const token = data.token
  try {
    await Taro.request({
      url: `${API_BASE}/api/auth/logout`,
      method: 'POST',
      header: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      data: {},
    })
  } catch {
    // ignore network errors on logout
  }
  clearLocal()
}

function getState(): AuthState {
  return {
    token: data.token,
    user: data.user,
    login,
    logout,
    clearLocal,
  }
}

function useAuthStoreHook<T>(selector: (state: AuthState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(getState()),
  )
}

export const useAuthStore = Object.assign(useAuthStoreHook, { getState })
