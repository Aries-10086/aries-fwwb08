import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuthStore } from '@/store/auth'
import { ArrowRight, Building2, Lock, UserRound } from 'lucide-react'

type OrgOption = { id: string; name: string }

export default function Register() {
  const nav = useNavigate()
  const { register } = useAuthStore()
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    orgUnitId: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/org-options')
      .then((r) => r.json())
      .then((json) => {
        const list = (json?.data ?? []) as OrgOption[]
        setOrgs(list)
        if (list[0]) setForm((p) => ({ ...p, orgUnitId: p.orgUnitId || list[0].id }))
      })
      .catch(() => setOrgs([]))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.password !== form.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      await register({
        name: form.name.trim(),
        username: form.username.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        orgUnitId: form.orgUnitId || undefined,
      })
      const role = useAuthStore.getState().user?.role
      nav(role === 'admin' ? '/admin/dashboard' : '/m/home')
    } catch (err: any) {
      setError(err?.message ?? '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit =
    form.name.trim() &&
    form.username.trim() &&
    form.password.length >= 6 &&
    form.confirmPassword.length >= 6

  return (
    <div className="flex min-h-[72vh] items-center">
      <section className="w-full rounded-[28px] bg-[#b91c1c] px-6 py-8 shadow-[0_22px_70px_rgba(185,28,28,0.22)] md:px-10">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-12 md:items-center">
          <div className="md:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
              Create Account
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] text-white md:text-5xl">注册账号</h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/85 md:text-[15px]">
              注册信息将写入后端 SQLite 用户表：账号唯一，密码以哈希形式保存。自助注册默认为党员角色。
            </p>
            <ul className="mt-6 space-y-2 text-sm text-white/80">
              <li>· 账号：3–32 位小写字母、数字或下划线</li>
              <li>· 密码：至少 6 位</li>
              <li>· 注册成功后自动登录进入学习端</li>
            </ul>
          </div>

          <div className="md:col-span-7">
            <form
              onSubmit={onSubmit}
              className="rounded-[24px] bg-white px-6 py-7 shadow-[0_18px_50px_rgba(0,0,0,0.12)]"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8c2424]/70">Sign Up</div>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#171717]">创建新账号</h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5 text-sm md:col-span-2">
                  <span className="field-label">姓名</span>
                  <div className="input-shell flex items-center gap-2 px-3">
                    <UserRound className="h-4 w-4 text-[#8c2424]" />
                    <input
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full bg-transparent py-2.5 outline-none"
                      placeholder="真实姓名或显示名"
                      required
                    />
                  </div>
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="field-label">登录账号</span>
                  <input
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value.toLowerCase() }))}
                    className="input-shell"
                    placeholder="例如：zhangsan"
                    autoComplete="username"
                    required
                  />
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="field-label">所属支部</span>
                  <div className="input-shell flex items-center gap-2 px-3">
                    <Building2 className="h-4 w-4 shrink-0 text-[#8c2424]" />
                    <select
                      value={form.orgUnitId}
                      onChange={(e) => setForm((p) => ({ ...p, orgUnitId: e.target.value }))}
                      className="w-full bg-transparent py-2.5 outline-none"
                    >
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                      {orgs.length === 0 && <option value="">默认支部</option>}
                    </select>
                  </div>
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="field-label">密码</span>
                  <div className="input-shell flex items-center gap-2 px-3">
                    <Lock className="h-4 w-4 text-[#8c2424]" />
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      className="w-full bg-transparent py-2.5 outline-none"
                      placeholder="至少 6 位"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="field-label">确认密码</span>
                  <div className="input-shell flex items-center gap-2 px-3">
                    <Lock className="h-4 w-4 text-[#8c2424]" />
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      className="w-full bg-transparent py-2.5 outline-none"
                      placeholder="再次输入密码"
                      autoComplete="new-password"
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

              <Button type="submit" disabled={loading || !canSubmit} className="mt-6 w-full px-7">
                {loading ? '注册中…' : '注册并登录'}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="mt-4 text-center text-xs text-black/45">
                已有账号？{' '}
                <Link to="/login" className="font-semibold text-[#8c2424] underline-offset-2 hover:underline">
                  去登录
                </Link>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
