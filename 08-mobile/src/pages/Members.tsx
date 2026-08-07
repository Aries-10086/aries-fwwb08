import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ArrowLeft } from '@phosphor-icons/react'

type MemberRow = {
  userId: string
  name: string
  username: string
  durationHours: number
  taskCompletionRate: number
  attemptCount: number
  avgScore: number | null
}

type ScoreRow = {
  userId: string
  evalScore?: number
  evalRank?: number | null
  latestScore: number | null
  latestIsPass: boolean | null
}

export default function Members() {
  const { userId: detailId } = useParams()
  const { user } = useAuthStore()
  const nav = useNavigate()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [orgName, setOrgName] = useState('')
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user && user.role !== 'secretary' && user.role !== 'admin') nav('/home', { replace: true })
  }, [user, nav])

  useEffect(() => {
    void (async () => {
      try {
        const [dash, scoreData] = await Promise.all([
          apiFetch<{ orgName: string; members: MemberRow[] }>('/api/stats/branch-dashboard'),
          apiFetch<{ members: ScoreRow[] }>('/api/stats/member-scores'),
        ])
        setOrgName(dash.orgName)
        setMembers(dash.members ?? [])
        setScores(scoreData.members ?? [])
      } catch (e: any) {
        setError(e?.message ?? '加载失败')
      }
    })()
  }, [])

  const scoreById = useMemo(() => new Map(scores.map((s) => [s.userId, s])), [scores])
  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase()
    if (!key) return members
    return members.filter(
      (m) => m.name.toLowerCase().includes(key) || m.username.toLowerCase().includes(key),
    )
  }, [members, q])

  const detail = detailId ? members.find((m) => m.userId === detailId) : null
  const detailScore = detailId ? scoreById.get(detailId) : null

  if (detailId) {
    return (
      <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
        <button type="button" className="inline-flex items-center gap-1 text-sm text-ink/55" onClick={() => nav('/members')}>
          <ArrowLeft size={16} /> 返回人员
        </button>
        {!detail && <div className="mt-8 text-center text-sm text-ink/40">未找到该党员</div>}
        {detail && (
          <>
            <h1 className="mt-3 text-2xl font-bold">{detail.name}</h1>
            <p className="mt-1 text-sm text-ink/45">@{detail.username}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ['学习时长', `${detail.durationHours}h`],
                ['任务完成', `${detail.taskCompletionRate}%`],
                ['测验次数', detail.attemptCount],
                ['测验均分', detail.avgScore ?? '—'],
                ['综合分', detailScore?.evalScore ?? '—'],
                ['最近成绩', detailScore?.latestScore ?? '—'],
              ].map(([k, v]) => (
                <div key={String(k)} className="m-card p-3">
                  <div className="text-[11px] text-ink/40">{k}</div>
                  <div className="mt-1 text-lg font-bold">{v}</div>
                </div>
              ))}
            </div>
            {detailScore?.latestIsPass != null && (
              <div className="mt-3 text-sm text-ink/55">
                最近测验：{detailScore.latestIsPass ? '通过' : '未通过'}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
      <h1 className="pt-2 text-2xl font-bold">支部人员</h1>
      <p className="mt-1 text-sm text-ink/50">{orgName || '本支部'}</p>
      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}
      <input
        className="m-input mt-4"
        placeholder="搜索姓名 / 账号"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mt-3 grid gap-2">
        {filtered.map((m) => {
          const s = scoreById.get(m.userId)
          return (
            <Link key={m.userId} to={`/members/${m.userId}`} className="m-card flex items-center justify-between p-3">
              <div>
                <div className="text-sm font-medium">{m.name}</div>
                <div className="mt-0.5 text-xs text-ink/45">
                  任务 {m.taskCompletionRate}% · 测验 {m.attemptCount} 次
                  {s?.evalRank != null ? ` · 排名 ${s.evalRank}` : ''}
                </div>
              </div>
              <div className="text-right text-sm font-bold text-seal">{m.avgScore ?? '—'} 分</div>
            </Link>
          )
        })}
        {filtered.length === 0 && <div className="py-10 text-center text-sm text-ink/40">暂无人员</div>}
      </div>
      <Link to="/tasks" className="mt-4 block">
        <Button variant="secondary" className="w-full">
          去发布任务
        </Button>
      </Link>
    </div>
  )
}
