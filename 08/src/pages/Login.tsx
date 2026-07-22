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
    <div className="flex min-h-[72vh] items-center">
      <section className="w-full rounded-[28px] bg-[#b91c1c] px-6 py-8 shadow-[0_22px_70px_rgba(185,28,28,0.22)] md:px-10">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-12 md:items-center">
          <div className="md:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
              Secure Access
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] text-white md:text-5xl">
              账号密码登录
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/85 md:text-[15px]">
              使用账号与密码进入系统。管理员进入后台治理，党员与支部书记进入学习端。没有账号可先注册。
            </p>
          </div>

          <div className="md:col-span-6">
            <form
              onSubmit={onSubmit}
              className="rounded-[24px] bg-white px-6 py-7 shadow-[0_18px_50px_rgba(0,0,0,0.12)]"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8c2424]/70">
                Sign In
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#171717]">登录数智党校</h2>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-1.5 text-sm">
                  <span className="field-label">账号</span>
                  <div className="input-shell flex items-center gap-2 px-3">
                    <UserRound className="h-4 w-4 text-[#8c2424]" />
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
                    <Lock className="h-4 w-4 text-[#8c2424]" />
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
                <div className="mt-4 rounded-2xl bg-[#b91c1c]/10 px-4 py-3 text-sm text-[#7f1d1d] shadow-[inset_0_0_0_1px_rgba(185,28,28,0.16)]">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading || !username.trim() || !password} className="mt-6 w-full px-7">
                {loading ? '登录中…' : '登录'}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="mt-4 text-center text-xs text-black/45">
                还没有账号？{' '}
                <Link to="/register" className="font-semibold text-[#8c2424] underline-offset-2 hover:underline">
                  立即注册
                </Link>
                <span className="mx-2 text-black/25">·</span>
                返回{' '}
                <Link to="/" className="font-semibold text-[#8c2424] underline-offset-2 hover:underline">
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
