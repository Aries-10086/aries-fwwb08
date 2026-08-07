import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { RankBadge } from '@/components/RankBadge'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ChartBar,
  ArrowsClockwise,
  Trophy,
  Users,
  WarningCircle,
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
  evalScore?: number
  evalLevel?: string
  evalRank?: number | null
  durationHours?: number
  completedContentCount?: number
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

type BranchExam = {
  examId: string
  title: string
  passScore: number
  status: string
  createdAt: string | null
  memberCount: number
  attemptedCount: number
  notAttemptedCount: number
  avgScore: number
  passRate: number
  attempted: Array<{
    userId: string
    name: string
    username: string
    score: number
    isPass: boolean
    submittedAt: string | null
    attemptId: string
  }>
  notAttempted: Array<{ userId: string; name: string; username: string }>
}

type BranchExamsData = {
  orgUnitId: string
  orgName: string
  exams: BranchExam[]
}

export default function SecretaryScores() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [data, setData] = useState<MemberScoresData | null>(null)
  const [examsData, setExamsData] = useState<BranchExamsData | null>(null)
  const [tab, setTab] = useState<'rank' | 'exams'>('rank')
  const [examId, setExamId] = useState<string>('')
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
      const [scores, exams] = await Promise.all([
        apiFetch<MemberScoresData>('/api/stats/member-scores'),
        apiFetch<BranchExamsData>('/api/stats/branch-exams'),
      ])
      setData(scores)
      setExamsData(exams)
      setExamId((prev) => prev || exams.exams[0]?.examId || '')
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && (user.role === 'secretary' || user.role === 'admin')) void load()
  }, [user?.id, user?.role])

  const summary = data?.summary
  const activeExam = useMemo(
    () => (examsData?.exams ?? []).find((e) => e.examId === examId) ?? null,
    [examId, examsData?.exams],
  )

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">支部成绩</div>
          <h1 className="page-title text-3xl md:text-4xl">支部成绩</h1>
          {data?.orgName ? (
            <div className="page-subtitle mt-2 max-w-2xl">{data.orgName}</div>
          ) : null}
        </div>
        <Button variant="ghost" onClick={() => void load()} disabled={loading}>
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

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === 'rank' ? 'primary' : 'secondary'} onClick={() => setTab('rank')}>
          综合排行榜
        </Button>
        <Button variant={tab === 'exams' ? 'primary' : 'secondary'} onClick={() => setTab('exams')}>
          各次测验成绩
        </Button>
      </div>

      {tab === 'rank' && (
        <Card>
          <CardHeader>
            <CardTitle>党员综合评价排行</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 text-xs text-black/45">
              综合分 = 学习时长（≤20）+ 完成内容（≤20）+ 测验均分×0.6（≤60）；列表已按个人名次排序
            </div>
            <div className="grid gap-2">
              {(data?.members ?? []).map((m) => (
                <Link
                  key={m.userId}
                  to={`/m/members/${m.userId}`}
                  className="grid gap-3 rounded-2xl bg-white/90 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition hover:bg-[rgba(158,27,43,0.03)] md:grid-cols-[auto_1.1fr_0.7fr_0.7fr_0.7fr_1.3fr]"
                >
                  <RankBadge rank={m.evalRank} />
                  <div>
                    <div className="text-sm font-medium text-[#12151c]">{m.name}</div>
                    <div className="mt-1 text-xs text-black/45">
                      {m.username ? `@${m.username}` : m.userId}
                      {m.evalLevel ? ` · ${m.evalLevel}` : ''}
                    </div>
                  </div>
                  <div className="text-sm text-black/70">
                    <div className="text-xs font-medium text-black/40">综合分</div>
                    <div className="mt-1 font-semibold text-[#9e1b2b]">{m.evalScore ?? 0}</div>
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
                      <div className="mt-1 text-black/45">
                        暂无考试 · 时长 {m.durationHours ?? 0}h · 完成 {m.completedContentCount ?? 0}
                      </div>
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
                </Link>
              ))}
              {(data?.members ?? []).length === 0 && (
                <div className="py-10 text-center text-sm text-black/45">本支部暂无党员，或尚未分配下级成员</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'exams' && (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>选择测验</CardTitle>
            </CardHeader>
            <CardContent>
              {(examsData?.exams ?? []).length === 0 ? (
                <div className="py-6 text-sm text-zinc-400">本支部暂无测验</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(examsData?.exams ?? []).map((e) => (
                    <button
                      key={e.examId}
                      type="button"
                      onClick={() => setExamId(e.examId)}
                      className={[
                        'rounded-full px-3 py-1.5 text-sm transition',
                        examId === e.examId
                          ? 'bg-[#9e1b2b] text-white'
                          : 'bg-white text-[#12151c] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[rgba(158,27,43,0.04)]',
                      ].join(' ')}
                    >
                      {e.title}
                      <span className="ml-1 opacity-70">
                        ({e.attemptedCount}/{e.memberCount})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {activeExam && (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ['参考人数', `${activeExam.attemptedCount}/${activeExam.memberCount}`],
                  ['未参与', `${activeExam.notAttemptedCount}`],
                  ['本次均分', `${activeExam.avgScore}`],
                  ['本次通过率', `${activeExam.passRate}%`],
                ].map(([label, value]) => (
                  <Card key={label}>
                    <CardContent className="pt-5">
                      <div className="text-xs font-medium text-[#9e1b2b]/60">{label}</div>
                      <div className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#12151c]">{value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-12">
                <Card className="md:col-span-7">
                  <CardHeader>
                    <CardTitle>已参与成绩 · {activeExam.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2">
                      {activeExam.attempted.map((m, idx) => (
                        <div
                          key={m.userId}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#9e1b2b]/10 text-xs font-bold text-[#9e1b2b]">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{m.name}</div>
                              <div className="text-xs text-zinc-500">
                                {m.submittedAt ? new Date(m.submittedAt).toLocaleString() : ''}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{m.score} 分</span>
                            <span
                              className={[
                                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                                m.isPass
                                  ? 'bg-emerald-500/10 text-emerald-700'
                                  : 'bg-[#9e1b2b]/10 text-[#9e1b2b]',
                              ].join(' ')}
                            >
                              {m.isPass ? '通过' : '未通过'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {activeExam.attempted.length === 0 && (
                        <div className="py-8 text-sm text-zinc-400">尚无党员参加本次测验</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <WarningCircle className="h-5 w-5 text-[#9e1b2b]" />
                      未参与人员
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-2 text-xs text-zinc-500">方便督促尚未作答的党员</div>
                    <div className="grid gap-2">
                      {activeExam.notAttempted.map((m) => (
                        <Link
                          key={m.userId}
                          to={`/m/members/${m.userId}`}
                          className="rounded-xl bg-[rgba(158,27,43,0.04)] px-4 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(158,27,43,0.12)]"
                        >
                          <div className="font-medium text-[#12151c]">{m.name}</div>
                          <div className="mt-0.5 text-xs text-zinc-500">
                            {m.username ? `@${m.username}` : m.userId} · 点击查看详情
                          </div>
                        </Link>
                      ))}
                      {activeExam.notAttempted.length === 0 && (
                        <div className="py-8 text-sm text-emerald-700">本支部党员均已参与</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
