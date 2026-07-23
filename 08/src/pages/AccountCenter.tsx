import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore, type AuthUser } from '@/store/auth'
import {
  BarChart3,
  BookOpen,
  Clock3,
  KeyRound,
  Loader2,
  RotateCw,
  Save,
  Trophy,
  UserRound,
} from 'lucide-react'

type MyCenter = {
  profile: {
    id: string
    name: string
    username: string
    role: string
    orgUnitId: string
    orgName: string
    createdAt: string | null
  }
  learning: {
    durationMs: number
    durationHours: number
    durationMinutes: number
    completedContentCount: number
    recordCount: number
    branchRank: number | null
    branchMemberCount: number | null
  }
  exams: {
    attemptCount: number
    avgScore: number | null
    bestScore: number | null
    passCount: number
    passRate: number | null
    attempts: Array<{
      id: string
      examId: string
      examTitle: string
      totalScore: number
      passScore: number | null
      isPass: boolean
      createdAt: string
    }>
  }
}

const roleLabel: Record<string, string> = {
  admin: '管理员',
  secretary: '支部书记',
  member: '党员',
}

export default function AccountCenter() {
  const nav = useNavigate()
  const { user, token } = useAuthStore()
  const [data, setData] = useState<MyCenter | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)

  const [pwd, setPwd] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdOk, setPwdOk] = useState(false)

  useEffect(() => {
    if (!user) nav('/login')
  }, [nav, user])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<MyCenter>('/api/stats/my-center')
      setData(res)
      setName(res.profile.name)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) load()
  }, [user?.id])

  async function saveProfile() {
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim() }),
      })
      const next = res.user
      useAuthStore.setState({ token, user: next })
      try {
        localStorage.setItem('party_school_auth', JSON.stringify({ token, user: next }))
      } catch {
        null
      }
      setProfileMsg('资料已保存')
      await load()
    } catch (e: any) {
      setProfileMsg(e?.message ?? '保存失败')
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError(null)
    setPwdOk(false)
    if (pwd.newPassword !== pwd.confirmPassword) {
      setPwdError('两次输入的新密码不一致')
      return
    }
    if (pwd.newPassword.length < 6) {
      setPwdError('新密码至少 6 位')
      return
    }
    setSavingPwd(true)
    try {
      await apiFetch<void>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: pwd.oldPassword,
          newPassword: pwd.newPassword,
        }),
      })
      setPwdOk(true)
      setPwd({ oldPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err: any) {
      setPwdError(err?.message ?? '修改失败')
    } finally {
      setSavingPwd(false)
    }
  }

  const learning = data?.learning
  const exams = data?.exams
  const profile = data?.profile

  return (
    <div className="grid gap-6">
      <div className="hero-frame px-6 py-7 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="page-eyebrow">Account</div>
            <h1 className="page-title text-3xl md:text-5xl">个人中心</h1>
            <div className="page-subtitle mt-2 max-w-2xl">
              查看与管理个人资料、学习时长、测验成绩，并可修改登录密码。
            </div>
          </div>
          <Button variant="ghost" onClick={() => load()} disabled={loading}>
            <RotateCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            刷新
          </Button>
        </div>

        {learning && exams && (
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              ['学习时长', `${learning.durationHours} h`, Clock3],
              ['已完成内容', `${learning.completedContentCount}`, BookOpen],
              ['测验均分', exams.avgScore == null ? '—' : `${exams.avgScore}`, BarChart3],
              [
                '支部时长排名',
                learning.branchRank != null
                  ? `${learning.branchRank}/${learning.branchMemberCount ?? '—'}`
                  : '—',
                Trophy,
              ],
            ].map(([label, value, Icon]) => {
              const I = Icon as typeof Clock3
              return (
                <div key={String(label)} className="panel-muted rounded-2xl px-4 py-4">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-[#a31828]/70">
                    <I className="h-3.5 w-3.5" />
                    {label as string}
                  </div>
                  <div className="mt-3 text-2xl font-black tracking-[-0.05em] text-[#0e1116]">
                    {value as string}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-[#a31828]" />
              个人资料
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile ? (
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm">
                  <span className="field-label">显示姓名</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-shell"
                  />
                </label>
                <div className="grid gap-2 rounded-xl bg-white/90 px-4 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                  <div className="flex justify-between gap-3">
                    <span className="text-[rgba(14,17,22,0.45)]">账号</span>
                    <span className="font-medium">{profile.username || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[rgba(14,17,22,0.45)]">角色</span>
                    <span className="font-medium">{roleLabel[profile.role] ?? profile.role}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[rgba(14,17,22,0.45)]">所属支部</span>
                    <span className="font-medium">{profile.orgName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[rgba(14,17,22,0.45)]">注册时间</span>
                    <span className="font-medium">
                      {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
                {profileMsg && (
                  <div className="text-sm text-[#a31828]">{profileMsg}</div>
                )}
                <Button onClick={() => saveProfile()} disabled={savingProfile || !name.trim()}>
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  保存资料
                </Button>
              </div>
            ) : (
              <div className="py-8 text-sm text-zinc-400">加载中…</div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#a31828]" />
              修改密码
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={changePassword}>
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
                    value={pwd[key]}
                    onChange={(e) => setPwd((p) => ({ ...p, [key]: e.target.value }))}
                    className="input-shell"
                    autoComplete={key === 'oldPassword' ? 'current-password' : 'new-password'}
                  />
                </label>
              ))}
              {pwdError && (
                <div className="rounded-2xl bg-[rgba(163,24,40,0.08)] px-4 py-3 text-sm text-[#7a1020]">
                  {pwdError}
                </div>
              )}
              {pwdOk && <div className="text-sm text-[#1f6b4a]">密码已更新</div>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={savingPwd}>
                  {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  确认改密
                </Button>
                <Link to="/account/password">
                  <Button type="button" variant="secondary">
                    独立改密页
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-[#a31828]" />
              学习时长汇总
            </CardTitle>
          </CardHeader>
          <CardContent>
            {learning ? (
              <div className="grid gap-3 text-sm">
                <div className="list-surface flex justify-between">
                  <span className="text-[rgba(14,17,22,0.55)]">累计时长</span>
                  <span className="font-semibold">
                    {learning.durationHours} 小时（{learning.durationMinutes} 分钟）
                  </span>
                </div>
                <div className="list-surface flex justify-between">
                  <span className="text-[rgba(14,17,22,0.55)]">已完成内容</span>
                  <span className="font-semibold">{learning.completedContentCount} 项</span>
                </div>
                <div className="list-surface flex justify-between">
                  <span className="text-[rgba(14,17,22,0.55)]">学习记录条数</span>
                  <span className="font-semibold">{learning.recordCount}</span>
                </div>
                {learning.branchRank != null && (
                  <div className="list-surface flex justify-between">
                    <span className="text-[rgba(14,17,22,0.55)]">支部学习时长排名</span>
                    <span className="font-semibold text-[#a31828]">
                      第 {learning.branchRank} / {learning.branchMemberCount}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-sm text-zinc-400">暂无数据</div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#a31828]" />
              我的成绩
            </CardTitle>
          </CardHeader>
          <CardContent>
            {exams ? (
              <div className="grid gap-3">
                <div className="grid gap-2 md:grid-cols-4">
                  {[
                    ['作答次数', `${exams.attemptCount}`],
                    ['均分', exams.avgScore == null ? '—' : `${exams.avgScore}`],
                    ['最高分', exams.bestScore == null ? '—' : `${exams.bestScore}`],
                    ['通过率', exams.passRate == null ? '—' : `${exams.passRate}%`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(14,17,22,0.4)]">{k}</div>
                      <div className="mt-1 text-xl font-bold text-[#0e1116]">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  {exams.attempts.map((a) => (
                    <Link
                      key={a.id}
                      to={`/m/exam-result/${a.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition hover:bg-[rgba(163,24,40,0.05)]"
                    >
                      <div>
                        <div className="text-sm font-medium text-[#0e1116]">{a.examTitle}</div>
                        <div className="mt-1 text-xs text-[rgba(14,17,22,0.45)]">
                          {new Date(a.createdAt).toLocaleString()}
                          {a.passScore != null ? ` · 及格线 ${a.passScore}` : ''}
                          <span className="ml-2 text-[#a31828]">查看回顾</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-[#0e1116]">{a.totalScore} 分</div>
                        <span
                          className={[
                            'mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium',
                            a.isPass
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : 'bg-[rgba(163,24,40,0.08)] text-[#a31828]',
                          ].join(' ')}
                        >
                          {a.isPass ? '通过' : '未通过'}
                        </span>
                      </div>
                    </Link>
                  ))}
                  {exams.attempts.length === 0 && (
                    <div className="py-8 text-sm text-zinc-400">暂无考试记录，去测验页试一试</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-sm text-zinc-400">暂无数据</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
