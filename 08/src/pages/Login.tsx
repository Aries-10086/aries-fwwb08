import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuthStore } from '@/store/auth'
import { ArrowRight, Shield } from 'lucide-react'

export default function Login() {
  const nav = useNavigate()
  const { login } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onLogin() {
    setError(null)
    setLoading(true)
    try {
      await login('admin')
      nav('/admin/dashboard')
    } catch (e: any) {
      setError(e?.message ?? '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[72vh] items-center">
      <section className="w-full rounded-[28px] bg-[#b91c1c] px-6 py-8 shadow-[0_22px_70px_rgba(185,28,28,0.22)] md:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
              Welcome
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] text-white md:text-6xl">
              进入数智党校学习系统
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/85 md:text-[15px]">
              这是演示版登录入口。当前阶段不做账号校验，点击登录后将以系统管理员身份进入，直接查看组织、内容、任务、题库与统计等功能闭环。
            </p>
            {error && (
              <div className="mx-auto mt-6 max-w-xl rounded-2xl bg-white/12 px-4 py-3 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
                {error}
              </div>
            )}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => onLogin()} disabled={loading} className="px-7">
                <Shield className="h-4 w-4" />
                {loading ? '登录中…' : '登录'}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Link
                to="/login/roles"
                className="text-sm font-semibold text-white underline decoration-white/35 underline-offset-4 hover:decoration-white/70"
              >
                切换身份（高级）
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
