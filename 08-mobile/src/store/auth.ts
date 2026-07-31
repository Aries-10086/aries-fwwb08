import { create } from 'zustand'

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
}

const STORAGE_KEY = 'party_school_mobile_auth'

function loadInitial(): Pick<AuthState, 'token' | 'user'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }))
  } catch {
    return
  }
}

async function parseAuth(res: Response, fallback: string) {
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success || !json?.data?.user || !json?.data?.token) {
    throw new Error(json?.error ?? fallback)
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
    const { token, user } = await parseAuth(res, '登录失败')
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
        body: '{}',
      })
    } catch {
      null
    }
    set({ token: null, user: null })
    save(null, null)
  },
}))
