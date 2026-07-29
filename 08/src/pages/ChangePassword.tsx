import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ArrowLeft,
  Key,
  CircleNotch,
} from '@phosphor-icons/react'

export default function ChangePassword() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!user) nav('/login')
  }, [nav, user])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(false)
    if (form.newPassword !== form.confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }
    if (form.newPassword.length < 6) {
      setError('新密码至少 6 位')
      return
    }
    setLoading(true)
    try {
      await apiFetch<void>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: form.oldPassword,
          newPassword: form.newPassword,
        }),
      })
      setOk(true)
      setForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err: any) {
      setError(err?.message ?? '修改失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">账户安全</div>
          <h1 className="page-title text-3xl md:text-4xl">修改密码</h1>
        </div>
        <Link to="/account">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            返回个人中心
          </Button>
        </Link>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-[#9e1b2b]" />
            设置新密码
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={onSubmit}>
            {(
              [
                ['oldPassword', '原密码'],
                ['newPassword', '新密码'],
                ['confirmPassword', '确认新密码'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="grid gap-1 text-sm">
                <span className="field-label">{label}</span>
                <input
                  type="password"
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="input-shell"
                  autoComplete={key === 'oldPassword' ? 'current-password' : 'new-password'}
                />
              </label>
            ))}
            {error && (
              <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-sm text-[#741220]">
                {error}
              </div>
            )}
            {ok && (
              <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-sm text-[#9e1b2b]">
                密码已更新
              </div>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              确认修改
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
