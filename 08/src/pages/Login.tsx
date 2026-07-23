import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuthStore } from '@/store/auth'
import { ArrowRight, Lock, UserRound } from 'lucide-react'

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
    <div className="flex min-h-[70vh] items-center">
      <section className="relative w-full overflow-hidden bg-[linear-gradient(155deg,#5c0d18_0%,#a31828_45%,#7a1020_100%)] px-6 py-10 md:px-10 md:py-12">
        <div
          className="pointer-events-none absolute right-[8%] top-[16%] font-display text-[9rem] leading-none text-white/10 md:text-[12rem]"
          aria-hidden
        >
          印
        </div>
        <div className="relative mx-auto grid max-w-5xl gap-10 md:grid-cols-12 md:items-center">
          <div className="md:col-span-5">
            <p className="rise-in text-[11px] font-semibold tracking-[0.32em] text-white/65">安全进入</p>
            <h1 className="brand-mark rise-in rise-in-delay-1 mt-4 text-4xl text-white md:text-5xl">
              数智党校
            </h1>
            <p className="rise-in rise-in-delay-2 mt-4 max-w-md text-sm leading-7 text-white/80">
              使用账号与密码进入系统。管理员进入后台治理，党员与支部书记进入学习端。
            </p>
          </div>

          <div className="md:col-span-7">
            <form onSubmit={onSubmit} className="auth-panel rise-in rise-in-delay-2 px-6 py-7 md:px-8">
              <p className="field-label">登录</p>
              <h2 className="mt-2 font-serif text-2xl font-bold tracking-wide text-[#0e1116]">
                账号密码登录
              </h2>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-1.5 text-sm">
                  <span className="field-label">账号</span>
                  <div className="input-shell flex items-center gap-2 px-3">
                    <UserRound className="h-4 w-4 text-[#a31828]" />
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
                    <Lock className="h-4 w-4 text-[#a31828]" />
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
                <div className="mt-4 border border-[rgba(163,24,40,0.2)] bg-[rgba(163,24,40,0.08)] px-4 py-3 text-sm text-[#7a1020]">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading || !username.trim() || !password} className="mt-6 w-full px-7">
                {loading ? '登录中…' : '登录'}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="mt-4 text-center text-xs text-[rgba(14,17,22,0.45)]">
                还没有账号？{' '}
                <Link to="/register" className="font-semibold text-[#a31828] underline-offset-2 hover:underline">
                  立即注册
                </Link>
                <span className="mx-2 text-[rgba(14,17,22,0.2)]">·</span>
                返回{' '}
                <Link to="/" className="font-semibold text-[#a31828] underline-offset-2 hover:underline">
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
