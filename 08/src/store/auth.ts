import { create } from 'zustand'

export type UserRole = 'member' | 'secretary' | 'admin'

export interface AuthUser {
  id: string
  name: string
  role: UserRole
  orgUnitId: string
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  login: (role: UserRole) => Promise<void>
  logout: () => Promise<void>
}

function getDemoUser(role: UserRole): AuthUser {
  if (role === 'admin') {
    return {
      id: 'u_admin_demo',
      name: '系统管理员',
      role: 'admin',
      orgUnitId: 'ou_root',
    }
  }

  if (role === 'secretary') {
    return {
      id: 'u_secretary_demo',
      name: '支部书记',
      role: 'secretary',
      orgUnitId: 'ou_branch_1',
    }
  }

  return {
    id: 'u_member_demo',
    name: '党员用户',
    role: 'member',
    orgUnitId: 'ou_branch_1',
  }
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

export const useAuthStore = create<AuthState>((set, get) => ({
  ...loadInitial(),
  login: async (role) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      })

      const raw = await res.text()
      let json: any = null

      try {
        json = raw ? JSON.parse(raw) : null
      } catch {
        json = null
      }

      if (!res.ok) {
        throw new Error(json?.error ?? '登录失败')
      }

      if (!json?.success || !json?.data?.user || !json?.data?.token) {
        throw new Error(json?.error ?? '登录失败')
      }

      const token = String(json.data.token)
      const user = json.data.user as AuthUser

      set({ token, user })
      save(token, user)
      return
    } catch {
      const user = getDemoUser(role)
      const token = `demo_${user.id}`
      set({ token, user })
      save(token, user)
    }
  },
  logout: async () => {
    const userId = get().user?.id
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
    } catch {
      null
    }
    set({ token: null, user: null })
    save(null, null)
  },
}))
