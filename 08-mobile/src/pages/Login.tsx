import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuthStore } from '@/store/auth'
import { Lock, User } from '@phosphor-icons/react'

export default function Login() {
  const nav = useNavigate()
  const { login } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username.trim(), password)
      const role = useAuthStore.getState().user?.role
      if (role === 'admin') nav('/admin-tip', { replace: true })
      else if (role === 'secretary') nav('/dashboard', { replace: true })
      else nav('/home', { replace: true })
    } catch (err: any) {
      setError(err?.message ?? '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-[linear-gradient(160deg,#5a0e18_0%,#9e1b2b_48%,#741220_100%)] px-5 pb-8 pt-[max(2.5rem,var(--safe-top))]">
      <div className="pt-8 text-white">
        <p className="text-sm text-white/70">移动学习</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">数智党校</h1>
        <p className="mt-2 text-sm leading-6 text-white/75">任务 · 测验 · 报告 · 随身学</p>
      </div>

      <form onSubmit={onSubmit} className="mt-10 rounded-3xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-ink">账号登录</h2>
        <div className="mt-5 grid gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-medium text-seal">账号</span>
            <div className="m-input flex items-center gap-2 !py-0">
              <User size={16} className="text-seal" />
              <input
                className="w-full bg-transparent py-3 outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入账号"
                autoComplete="username"
                required
              />
            </div>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-medium text-seal">密码</span>
            <div className="m-input flex items-center gap-2 !py-0">
              <Lock size={16} className="text-seal" />
              <input
                type="password"
                className="w-full bg-transparent py-3 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
                required
              />
            </div>
          </label>
        </div>
        {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}
        <Button type="submit" className="mt-5 w-full" disabled={loading}>
          {loading ? '登录中…' : '进入学习'}
        </Button>
        <p className="mt-4 text-center text-xs text-ink/40">本端为移动端独立站点，管理后台请用 PC 端</p>
      </form>
    </div>
  )
}
