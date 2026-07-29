import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ArrowsClockwise,
  CaretLeft,
  Clock,
  Trophy,
  User,
  Users,
} from '@phosphor-icons/react'

type MemberRow = {
  userId: string
  name: string
  username: string
  durationHours: number
  completedContentCount: number
  taskCompletedCount: number
  taskCount: number
  taskCompletionRate: number
  attemptCount: number
  avgScore: number | null
  passCount: number
}

type BranchDashboard = {
  orgUnitId: string
  orgName: string
  summary: { memberCount: number }
  members: MemberRow[]
}

type MemberScore = {
  userId: string
  avgScore: number | null
  passRate: number | null
  latestScore: number | null
  latestIsPass: boolean | null
  latestExamTitle: string | null
  latestAt: string | null
  evalScore?: number
  evalLevel?: string
  evalRank?: number | null
}

export default function SecretaryMembers() {
  const nav = useNavigate()
  const { userId: detailId } = useParams()
  const { user } = useAuthStore()
  const [data, setData] = useState<BranchDashboard | null>(null)
  const [scores, setScores] = useState<MemberScore[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

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
      const [dash, scoreData] = await Promise.all([
        apiFetch<BranchDashboard>('/api/stats/branch-dashboard'),
        apiFetch<{ members: MemberScore[] }>('/api/stats/member-scores'),
      ])
      setData(dash)
      setScores(scoreData.members ?? [])
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && (user.role === 'secretary' || user.role === 'admin')) void load()
  }, [user?.id, user?.role])

  const scoreById = useMemo(() => new Map(scores.map((s) => [s.userId, s])), [scores])

  const members = useMemo(() => {
    const list = data?.members ?? []
    const key = q.trim().toLowerCase()
    if (!key) return list
    return list.filter(
      (m) =>
        m.name.toLowerCase().includes(key) ||
        m.username.toLowerCase().includes(key) ||
        m.userId.toLowerCase().includes(key),
    )
  }, [data?.members, q])

  const detail = useMemo(() => {
    if (!detailId) return null
    return (data?.members ?? []).find((m) => m.userId === detailId) ?? null
  }, [data?.members, detailId])

  const detailScore = detailId ? scoreById.get(detailId) : undefined

  if (detailId) {
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="page-eyebrow">本支部人员</div>
            <h1 className="page-title text-3xl md:text-4xl">{detail?.name ?? '党员详情'}</h1>
            <div className="page-subtitle mt-2 max-w-2xl">
              只读查看学习进度与测验成绩，用于督促；党员增删改由系统管理员统一管理。
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/m/members">
              <Button variant="secondary">
                <CaretLeft className="h-4 w-4" />
                返回列表
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>
              <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              刷新
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
            {error}
          </div>
        )}

        {!detail && !loading && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-zinc-400">
              未找到该党员，或其不属于本支部
            </CardContent>
          </Card>
        )}

        {detail && (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                ['学习时长', `${detail.durationHours} h`, Clock],
                ['任务完成', `${detail.taskCompletedCount}/${detail.taskCount}（${detail.taskCompletionRate}%）`, Users],
                ['已完成内容', `${detail.completedContentCount}`, User],
                ['测验均分', detail.avgScore == null ? '-' : String(detail.avgScore), Trophy],
              ].map(([label, value, Icon]) => {
                const I = Icon as typeof Users
                return (
                  <Card key={String(label)}>
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-2 text-xs font-medium text-[#9e1b2b]/60">
                        <I className="h-3.5 w-3.5" />
                        {label as string}
                      </div>
                      <div className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#12151c]">
                        {value as string}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>测验与综合评价</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                    <div className="text-xs text-zinc-500">账号</div>
                    <div className="mt-1 font-medium">
                      {detail.name}
                      {detail.username ? ` · @${detail.username}` : ''}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                    <div className="text-xs text-zinc-500">综合排名</div>
                    <div className="mt-1 font-medium">
                      {detailScore?.evalRank != null ? `第 ${detailScore.evalRank} 名` : '-'}
                      {detailScore?.evalScore != null ? ` · 综合分 ${detailScore.evalScore}` : ''}
                      {detailScore?.evalLevel ? ` · ${detailScore.evalLevel}` : ''}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                    <div className="text-xs text-zinc-500">作答次数 / 通过</div>
                    <div className="mt-1 font-medium">
                      {detail.attemptCount} 次 · 通过 {detail.passCount} 次
                      {detailScore?.passRate != null ? ` · 通过率 ${detailScore.passRate}%` : ''}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                    <div className="text-xs text-zinc-500">最近一次测验</div>
                    <div className="mt-1 font-medium">
                      {detailScore?.latestScore == null ? (
                        <span className="text-zinc-400">暂未参加测验</span>
                      ) : (
                        <>
                          {detailScore.latestScore} 分
                          <span
                            className={[
                              'ml-2 rounded-full px-2 py-0.5 text-[11px]',
                              detailScore.latestIsPass
                                ? 'bg-emerald-500/10 text-emerald-700'
                                : 'bg-[#9e1b2b]/10 text-[#9e1b2b]',
                            ].join(' ')}
                          >
                            {detailScore.latestIsPass ? '通过' : '未通过'}
                          </span>
                          <div className="mt-1 text-xs text-zinc-500">
                            {detailScore.latestExamTitle}
                            {detailScore.latestAt
                              ? ` · ${new Date(detailScore.latestAt).toLocaleString()}`
                              : ''}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-[rgba(18,21,28,0.45)]">
                  仅支持查看，不可增删改党员信息。跨支部数据不可见。
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">本支部人员</div>
          <h1 className="page-title text-3xl md:text-4xl">本支部党员</h1>
          <div className="page-subtitle mt-2 max-w-2xl">
            查看本支部党员学习与测验概况（只读）
            {data?.orgName ? ` · ${data.orgName}` : ''}
          </div>
        </div>
        <Button variant="ghost" onClick={() => void load()} disabled={loading}>
          <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索姓名 / 账号"
          className="input-shell max-w-xs"
        />
        <div className="text-xs text-zinc-500">共 {data?.summary.memberCount ?? 0} 人 · 不可增删改</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#9e1b2b]" />
            党员列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {members.map((m) => {
              const sc = scoreById.get(m.userId)
              return (
                <Link
                  key={m.userId}
                  to={`/m/members/${m.userId}`}
                  className="grid gap-3 rounded-2xl bg-white/90 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition hover:border-[rgba(158,27,43,0.16)] hover:shadow-[0_2px_8px_rgba(158,27,43,0.05)] md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_auto]"
                >
                  <div>
                    <div className="text-sm font-medium text-[#12151c]">{m.name}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {m.username ? `@${m.username}` : m.userId}
                      {sc?.evalRank != null ? ` · 综合第 ${sc.evalRank} 名` : ''}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="text-[11px] text-zinc-400">学习时长</div>
                    <div className="mt-1 font-semibold">{m.durationHours} h</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-[11px] text-zinc-400">任务完成</div>
                    <div className="mt-1 font-semibold">
                      {m.taskCompletedCount}/{m.taskCount}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="text-[11px] text-zinc-400">测验均分</div>
                    <div className="mt-1 font-semibold">{m.avgScore == null ? '-' : m.avgScore}</div>
                  </div>
                  <div className="self-center text-xs font-medium text-[#9e1b2b]">详情 →</div>
                </Link>
              )
            })}
            {members.length === 0 && (
              <div className="py-10 text-center text-sm text-zinc-400">
                {q.trim() ? '无匹配党员' : '本支部暂无党员'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
