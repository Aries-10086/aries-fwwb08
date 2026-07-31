import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'

type MyCenter = {
  profile: {
    name: string
    username: string
    role: string
    orgName: string
    createdAt: string | null
  }
  learning: { durationHours: number; completedContentCount: number }
  exams: { attemptCount: number; avgScore: number | null; passCount: number }
}

const roleLabel: Record<string, string> = {
  member: '党员',
  secretary: '支部书记',
  admin: '管理员',
}

export default function Account() {
  const nav = useNavigate()
  const { logout } = useAuthStore()
  const [data, setData] = useState<MyCenter | null>(null)
  const [pwd, setPwd] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setData(await apiFetch<MyCenter>('/api/stats/my-center'))
      } catch (e: any) {
        setErr(e?.message ?? '加载失败')
      }
    })()
  }, [])

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    if (pwd.newPassword !== pwd.confirmPassword) {
      setErr('两次新密码不一致')
      return
    }
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword: pwd.oldPassword, newPassword: pwd.newPassword }),
      })
      setMsg('密码已更新')
      setPwd({ oldPassword: '', newPassword: '', confirmPassword: '' })
    } catch (e: any) {
      setErr(e?.message ?? '改密失败')
    }
  }

  const p = data?.profile

  return (
    <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
      <h1 className="pt-2 text-2xl font-bold">我的</h1>
      {p && (
        <div className="m-card mt-4 grid gap-2 p-4 text-sm">
          {[
            ['姓名', p.name],
            ['账号', p.username],
            ['角色', roleLabel[p.role] ?? p.role],
            ['支部', p.orgName],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <span className="text-ink/45">{k}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ['时长', `${data.learning.durationHours}h`],
            ['完成', `${data.learning.completedContentCount}`],
            ['均分', data.exams.avgScore ?? '-'],
          ].map(([k, v]) => (
            <div key={k} className="m-card p-3 text-center">
              <div className="text-[11px] text-ink/40">{k}</div>
              <div className="mt-1 font-bold">{v}</div>
            </div>
          ))}
        </div>
      )}

      <form className="m-card mt-4 grid gap-3 p-4" onSubmit={changePassword}>
        <div className="text-sm font-semibold">修改密码</div>
        {(
          [
            ['oldPassword', '原密码'],
            ['newPassword', '新密码'],
            ['confirmPassword', '确认新密码'],
          ] as const
        ).map(([key, label]) => (
          <input
            key={key}
            type="password"
            className="m-input"
            placeholder={label}
            value={pwd[key]}
            onChange={(e) => setPwd((s) => ({ ...s, [key]: e.target.value }))}
            required
          />
        ))}
        {err && <div className="text-sm text-seal-deep">{err}</div>}
        {msg && <div className="text-sm text-[#1f6b4a]">{msg}</div>}
        <Button type="submit">确认改密</Button>
      </form>

      <Button
        variant="danger"
        className="mt-4 w-full"
        onClick={async () => {
          await logout()
          nav('/login', { replace: true })
        }}
      >
        退出登录
      </Button>
    </div>
  )
}
