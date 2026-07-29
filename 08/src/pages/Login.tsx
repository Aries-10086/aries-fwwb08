import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuthStore } from '@/store/auth'
import { ArrowRight, Lock, User } from '@phosphor-icons/react'

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
      nav(role === 'admin' ? '/admin/dashboard' : '/m/home')
    } catch (err: any) {
      setError(err?.message ?? '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[70dvh] items-center">
      <section className="relative w-full overflow-hidden bg-[linear-gradient(155deg,#5a0e18_0%,#9e1b2b_45%,#741220_100%)] px-6 py-10 md:px-10 md:py-12">
        <div
          className="pointer-events-none absolute right-[8%] top-[16%] font-display text-[9rem] leading-none text-white/10 md:text-[12rem]"
          aria-hidden
        >
          印
        </div>
        <div className="relative mx-auto grid max-w-5xl gap-10 md:grid-cols-12 md:items-center">
          <div className="md:col-span-5">
            <p className="rise-in text-sm font-medium text-white/70">安全进入</p>
            <h1 className="brand-mark rise-in rise-in-delay-1 mt-3 text-3xl text-white md:text-4xl">数智党校</h1>
          </div>

          <div className="md:col-span-7">
            <form onSubmit={onSubmit} className="auth-panel rise-in rise-in-delay-2 px-6 py-7 md:px-8">
              <p className="field-label">登录</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[#12151c]">账号密码登录</h2>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-1.5 text-sm">
                  <span className="field-label">账号</span>
                  <div className="input-shell flex items-center gap-2 px-3">
                    <User size={16} weight="bold" className="text-[#9e1b2b]" />
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-transparent py-2.5 outline-none"
                      placeholder="请输入账号"
                      autoComplete="username"
                      required
                    />
                  </div>
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="field-label">密码</span>
                  <div className="input-shell flex items-center gap-2 px-3">
                    <Lock size={16} weight="bold" className="text-[#9e1b2b]" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent py-2.5 outline-none"
                      placeholder="请输入密码"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </label>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-4 border border-[rgba(158,27,43,0.2)] bg-[rgba(158,27,43,0.08)] px-4 py-3 text-sm text-[#741220]"
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !username.trim() || !password}
                className="mt-6 w-full px-7"
              >
                {loading ? '登录中…' : '登录'}
                <ArrowRight size={16} weight="bold" />
              </Button>

              <div className="mt-4 text-center text-xs text-[rgba(18,21,28,0.45)]">
                还没有账号？{' '}
                <Link to="/register" className="font-semibold text-[#9e1b2b] underline-offset-2 hover:underline">
                  立即注册
                </Link>
                <span className="mx-2 text-[rgba(18,21,28,0.2)]">/</span>
                返回{' '}
                <Link to="/" className="font-semibold text-[#9e1b2b] underline-offset-2 hover:underline">
                  首页
                </Link>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
