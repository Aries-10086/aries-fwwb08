import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ArrowsClockwise } from '@phosphor-icons/react'

type Dash = {
  orgName: string
  summary: {
    memberCount: number
    durationHours: number
    avgDurationHours?: number
    overallTaskCompletionRate: number
    avgExamScore: number
    passRate: number
  }
  tasks: Array<{
    id: string
    title: string
    completionRate: number
    completedMemberCount: number
    pendingMembers?: Array<{ name: string }>
  }>
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const nav = useNavigate()
  const [data, setData] = useState<Dash | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'secretary' && user.role !== 'admin') nav('/home', { replace: true })
  }, [user, nav])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setData(await apiFetch<Dash>('/api/stats/branch-dashboard'))
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const s = data?.summary

  return (
    <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
      <div className="flex items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl font-bold">支部看板</h1>
          <p className="mt-1 text-sm text-ink/50">{data?.orgName ?? '本支部数据'}</p>
        </div>
        <Button variant="ghost" className="!min-h-9 px-3" disabled={loading} onClick={() => void load()}>
          <ArrowsClockwise className={loading ? 'animate-spin' : ''} size={16} />
        </Button>
      </div>
      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}

      {s && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            ['党员', s.memberCount],
            ['总时长', `${s.durationHours}h`],
            ['人均', `${s.avgDurationHours ?? 0}h`],
            ['任务完成', `${s.overallTaskCompletionRate}%`],
            ['测验均分', s.avgExamScore],
            ['通过率', `${s.passRate}%`],
          ].map(([k, v]) => (
            <div key={String(k)} className="m-card p-3">
              <div className="text-[11px] text-ink/40">{k}</div>
              <div className="mt-1 text-lg font-bold">{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Link to="/scores" className="flex-1">
          <Button variant="secondary" className="w-full">
            成绩明细
          </Button>
        </Link>
        <Link to="/home" className="flex-1">
          <Button className="w-full">去学习</Button>
        </Link>
      </div>

      <h2 className="mt-6 text-sm font-semibold">任务完成</h2>
      <div className="mt-2 grid gap-2">
        {(data?.tasks ?? []).map((t) => (
          <div key={t.id} className="m-card p-4">
            <div className="flex justify-between gap-2">
              <div className="text-sm font-medium">{t.title}</div>
              <div className="text-sm font-bold text-seal">{t.completionRate}%</div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
              <div className="h-full bg-seal" style={{ width: `${Math.min(100, t.completionRate)}%` }} />
            </div>
            {(t.pendingMembers?.length ?? 0) > 0 && (
              <div className="mt-2 text-xs text-ink/55">
                未完成：{(t.pendingMembers ?? []).map((m) => m.name).join('、')}
              </div>
            )}
          </div>
        ))}
        {(data?.tasks?.length ?? 0) === 0 && <div className="py-8 text-center text-sm text-ink/40">暂无任务</div>}
      </div>
    </div>
  )
}
