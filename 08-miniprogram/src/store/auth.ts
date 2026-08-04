import { create } from 'zustand'
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

export const useAuthStore = create<AuthState>((set, get) => ({
  ...loadInitial(),
  clearLocal: () => {
    set({ token: null, user: null })
    save(null, null)
  },
  login: async (username, password) => {
    if (!username || !password) {
      throw new Error('请输入账号和密码')
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
      throw new Error(`无法连接服务器（${API_BASE}），请确认 08 后端已启动`)
    }
    const json = (res.data ?? {}) as {
      success?: boolean
      error?: string
      data?: { token: string; user: AuthUser }
    }
    if (res.statusCode >= 400 || !json?.success || !json?.data?.user || !json?.data?.token) {
      throw new Error(json?.error ?? `登录失败（HTTP ${res.statusCode}）`)
    }
    const { token, user } = json.data
    set({ token, user })
    save(token, user)
  },
  logout: async () => {
    const token = get().token
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
    set({ token: null, user: null })
    save(null, null)
  },
}))
