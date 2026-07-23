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
    <div className="flex min-h-[70vh] items-center">
      <section className="relative w-full overflow-hidden bg-[linear-gradient(155deg,#5c0d18_0%,#a31828_45%,#7a1020_100%)] px-6 py-10 md:px-10 md:py-12">
        <div
          className="pointer-events-none absolute right-[6%] top-[12%] font-display text-[9rem] leading-none text-white/10 md:text-[12rem]"
          aria-hidden
        >
          学
        </div>
        <div className="relative mx-auto grid max-w-5xl gap-10 md:grid-cols-12 md:items-center">
          <div className="md:col-span-5">
            <p className="rise-in text-[11px] font-semibold tracking-[0.32em] text-white/65">创建账号</p>
            <h1 className="brand-mark rise-in rise-in-delay-1 mt-4 text-4xl text-white md:text-5xl">
              加入学习
            </h1>
            <p className="rise-in rise-in-delay-2 mt-4 max-w-md text-sm leading-7 text-white/80">
              自助注册默认为党员角色。账号唯一，密码以哈希形式保存，注册成功后自动登录。
            </p>
            <ul className="rise-in rise-in-delay-3 mt-6 space-y-2 text-sm text-white/75">
              <li className="flex gap-2">
                <span className="text-[#c9a84c]">—</span>
                账号：3–32 位小写字母、数字或下划线
              </li>
              <li className="flex gap-2">
                <span className="text-[#c9a84c]">—</span>
                密码：至少 6 位
              </li>
              <li className="flex gap-2">
                <span className="text-[#c9a84c]">—</span>
                注册后进入学习端
              </li>
            </ul>
          </div>

          <div className="md:col-span-7">
            <form onSubmit={onSubmit} className="auth-panel rise-in rise-in-delay-2 px-6 py-7 md:px-8">
              <p className="field-label">注册</p>
              <h2 className="mt-2 font-serif text-2xl font-bold tracking-wide text-[#0e1116]">
                创建新账号
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5 text-sm md:col-span-2">
                  <span className="field-label">姓名</span>
                  <div className="input-shell flex items-center gap-2 px-3">
                    <UserRound className="h-4 w-4 text-[#a31828]" />
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
                    <Building2 className="h-4 w-4 shrink-0 text-[#a31828]" />
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
                    <Lock className="h-4 w-4 text-[#a31828]" />
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
                    <Lock className="h-4 w-4 text-[#a31828]" />
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
                <div className="mt-4 border border-[rgba(163,24,40,0.2)] bg-[rgba(163,24,40,0.08)] px-4 py-3 text-sm text-[#7a1020]">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading || !canSubmit} className="mt-6 w-full px-7">
                {loading ? '注册中…' : '注册并登录'}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="mt-4 text-center text-xs text-[rgba(14,17,22,0.45)]">
                已有账号？{' '}
                <Link to="/login" className="font-semibold text-[#a31828] underline-offset-2 hover:underline">
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
