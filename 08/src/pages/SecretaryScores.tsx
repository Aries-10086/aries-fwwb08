import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ChartBar,
  ArrowsClockwise,
  Trophy,
  Users,
} from '@phosphor-icons/react'

type MemberScore = {
  userId: string
  name: string
  username: string
  attemptCount: number
  avgScore: number | null
  passCount: number
  passRate: number | null
  latestScore: number | null
  latestIsPass: boolean | null
  latestExamTitle: string | null
  latestAt: string | null
}

type MemberScoresData = {
  orgUnitId: string | null
  orgName: string
  summary: {
    memberCount: number
    attemptedMemberCount: number
    attemptCount: number
    avgScore: number
    passRate: number
  }
  members: MemberScore[]
}

export default function SecretaryScores() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [data, setData] = useState<MemberScoresData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      nav('/login')
      return
    }
    if (user.role !== 'secretary' && user.role !== 'admin') {
      nav('/m/home')
    }
  }, [nav, user])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<MemberScoresData>('/api/stats/member-scores')
      setData(res)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && (user.role === 'secretary' || user.role === 'admin')) load()
  }, [user?.id, user?.role])

  const summary = data?.summary

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">支部成绩</div>
          <h1 className="page-title text-3xl md:text-4xl">支部成绩</h1>
          <div className="page-subtitle mt-2 max-w-2xl">
            查看本支部下级党员的测验成绩汇总与明细
            {data?.orgName ? `（${data.orgName}）` : ''}。
          </div>
        </div>
        <Button variant="ghost" onClick={() => load()} disabled={loading}>
          <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[#9e1b2b]/10 px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(185,28,28,0.16)]">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ['党员数', `${summary?.memberCount ?? 0}`, Users],
          ['已参考人数', `${summary?.attemptedMemberCount ?? 0}`, Trophy],
          ['测验均分', `${summary?.avgScore ?? 0}`, ChartBar],
          ['通过率', `${summary?.passRate ?? 0}%`, ChartBar],
        ].map(([label, value, Icon]) => {
          const I = Icon as typeof Users
          return (
            <Card key={String(label)}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-xs font-medium text-[#9e1b2b]/60">
                  <I className="h-3.5 w-3.5" />
                  {label as string}
                </div>
                <div className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[#12151c]">{value as string}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>成员成绩明细</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {(data?.members ?? []).map((m) => (
              <div
                key={m.userId}
                className="grid gap-3 rounded-2xl bg-white/90 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] md:grid-cols-[1.3fr_0.7fr_0.7fr_1.4fr]"
              >
                <div>
                  <div className="text-sm font-medium text-[#12151c]">{m.name}</div>
                  <div className="mt-1 text-xs text-black/45">{m.username ? `@${m.username}` : m.userId}</div>
                </div>
                <div className="text-sm text-black/70">
                  <div className="text-xs font-medium text-black/40">均分 / 次数</div>
                  <div className="mt-1 font-semibold">
                    {m.avgScore == null ? '-' : m.avgScore}
                    <span className="ml-1 text-xs font-normal text-black/45">/ {m.attemptCount} 次</span>
                  </div>
                </div>
                <div className="text-sm text-black/70">
                  <div className="text-xs font-medium text-black/40">通过率</div>
                  <div className="mt-1 font-semibold">{m.passRate == null ? '-' : `${m.passRate}%`}</div>
                </div>
                <div className="text-sm text-black/70">
                  <div className="text-xs font-medium text-black/40">最近一次</div>
                  {m.latestScore == null ? (
                    <div className="mt-1 text-black/45">暂无考试记录</div>
                  ) : (
                    <div className="mt-1">
                      <span className="font-semibold">{m.latestScore} 分</span>
                      <span
                        className={[
                          'ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          m.latestIsPass
                            ? 'bg-emerald-500/10 text-emerald-700'
                            : 'bg-[#9e1b2b]/10 text-[#9e1b2b]',
                        ].join(' ')}
                      >
                        {m.latestIsPass ? '通过' : '未通过'}
                      </span>
                      <div className="mt-1 text-xs text-black/45">
                        {m.latestExamTitle ?? '测验'}
                        {m.latestAt ? ` · ${new Date(m.latestAt).toLocaleString()}` : ''}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(data?.members ?? []).length === 0 && (
              <div className="py-10 text-center text-sm text-black/45">本支部暂无党员，或尚未分配下级成员</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
