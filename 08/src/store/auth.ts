import { create } from 'zustand'
import type { User, UserRole } from '../../shared/types'

export type { UserRole }
/** 登录态用户；与 shared/types.User 对齐（username 必填） */
export type AuthUser = User

export interface RegisterPayload {
  name: string
  username: string
  password: string
  confirmPassword?: string
  orgUnitId?: string
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  login: (username: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
}

function loadInitial(): Pick<AuthState, 'token' | 'user'> {
  try {
    const raw = localStorage.getItem('party_school_auth')
    if (!raw) return { token: null, user: null }
    const parsed = JSON.parse(raw) as { token: string; user: AuthUser }
    return { token: parsed.token ?? null, user: parsed.user ?? null }
  } catch {
    return { token: null, user: null }
  }
}

function save(token: string | null, user: AuthUser | null) {
  try {
    if (!token || !user) {
      localStorage.removeItem('party_school_auth')
      return
    }
    localStorage.setItem('party_school_auth', JSON.stringify({ token, user }))
  } catch {
    return
  }
}

async function parseAuthResponse(res: Response, fallbackError: string) {
  const raw = await res.text()
  let json: any = null
  try {
    json = raw ? JSON.parse(raw) : null
  } catch {
    json = null
  }

  if (!res.ok || !json?.success || !json?.data?.user || !json?.data?.token) {
    throw new Error(json?.error ?? fallbackError)
  }

  return {
    token: String(json.data.token),
    user: json.data.user as AuthUser,
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...loadInitial(),
  login: async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const { token, user } = await parseAuthResponse(res, '登录失败')
    set({ token, user })
    save(token, user)
  },
  register: async (payload) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const { token, user } = await parseAuthResponse(res, '注册失败')
    set({ token, user })
    save(token, user)
  },
  logout: async () => {
    const token = get().token
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      })
    } catch {
      null
    }
    set({ token: null, user: null })
    save(null, null)
  },
}))
