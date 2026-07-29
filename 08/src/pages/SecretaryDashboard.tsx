import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Chart } from '@/components/Chart'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ChartBar,
  CheckCircle,
  Clock,
  ArrowsClockwise,
  Trophy,
  Users,
  Warning,
  ListBullets,
  Sparkle,
} from '@phosphor-icons/react'
import type { EChartsOption } from 'echarts'

type BranchDashboard = {
  orgUnitId: string
  orgName: string
  summary: {
    memberCount: number
    durationHours: number
    avgDurationHours?: number
    avgExamScore: number
    passRate: number
    attemptCount: number
    taskCount: number
    latestTaskCompletionRate: number
    overallTaskCompletionRate: number
    contentCompletionRate: number
    requiredContentCount: number
  }
  tasks: Array<{
    id: string
    title: string
    dueAt: string | null
    contentCount: number
    completedMemberCount: number
    completionRate: number
    completedMembers?: Array<{ userId: string; name: string }>
    pendingMembers?: Array<{ userId: string; name: string }>
  }>
  members: Array<{
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
  }>
  weakCategories?: Array<{
    category: string
    wrongCount: number
    memberCount: number
    sharePercent: number
  }>
  wrongTop?: Array<{
    questionId: string
    stem: string
    category: string
    type: string
    wrongCount: number
    memberCount: number
  }>
}

const typeLabel: Record<string, string> = {
  single: '单选',
  multiple: '多选',
  tf: '判断',
}

export default function SecretaryDashboard() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [data, setData] = useState<BranchDashboard | null>(null)
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
      const query =
        user?.role === 'admin' && user.orgUnitId
          ? `?orgUnitId=${encodeURIComponent(user.orgUnitId)}`
          : ''
      const res = await apiFetch<BranchDashboard>(`/api/stats/branch-dashboard${query}`)
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

  const overviewOption = useMemo((): EChartsOption => {
    if (!summary) return {}
    return {
      backgroundColor: 'transparent',
      grid: { left: 48, right: 18, top: 24, bottom: 36 },
      xAxis: {
        type: 'category',
        data: ['学习时长(h)', '任务完成率(%)', '内容完成率(%)', '测验均分', '通过率(%)'],
        axisLabel: { color: 'rgba(23,23,23,0.55)', fontSize: 11, interval: 0, rotate: 18 },
        axisLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(23,23,23,0.45)', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
      },
      series: [
        {
          type: 'bar',
          data: [
            summary.durationHours,
            summary.overallTaskCompletionRate,
            summary.contentCompletionRate,
            summary.avgExamScore,
            summary.passRate,
          ],
          itemStyle: {
            color: 'rgba(158,27,43,0.85)',
            borderRadius: [8, 8, 0, 0],
          },
          barMaxWidth: 42,
        },
      ],
      tooltip: { trigger: 'axis' },
    }
  }, [summary])

  const memberDurationOption = useMemo((): EChartsOption => {
    const rows = [...(data?.members ?? [])].sort((a, b) => b.durationHours - a.durationHours).slice(0, 10)
    if (rows.length === 0) return {}
    return {
      backgroundColor: 'transparent',
      grid: { left: 72, right: 24, top: 16, bottom: 28 },
      xAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(23,23,23,0.45)', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
      },
      yAxis: {
        type: 'category',
        data: rows.map((m) => m.name).reverse(),
        axisLabel: { color: 'rgba(23,23,23,0.65)', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } },
      },
      series: [
        {
          type: 'bar',
          data: rows.map((m) => m.durationHours).reverse(),
          itemStyle: { color: 'rgba(158,27,43,0.75)', borderRadius: [0, 6, 6, 0] },
          barMaxWidth: 18,
        },
      ],
      tooltip: { trigger: 'axis', valueFormatter: (v) => `${v} 小时` },
    }
  }, [data?.members])

  return (
    <div className="grid gap-6">
      <div className="hero-frame px-6 py-7 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="page-eyebrow">支部看板</div>
            <h1 className="page-title text-3xl md:text-5xl">支部数据看板</h1>
            {data?.orgName ? (
              <div className="page-subtitle mt-2 max-w-2xl">{data.orgName}</div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/m/members">
              <Button variant="secondary">
                <Users className="h-4 w-4" />
                本支部人员
              </Button>
            </Link>
            <Link to="/m/scores">
              <Button variant="secondary">
                <Trophy className="h-4 w-4" />
                成绩明细
              </Button>
            </Link>
            <Link to="/admin/tasks">
              <Button variant="secondary">
                <ListBullets className="h-4 w-4" />
                发布任务
              </Button>
            </Link>
            <Link to="/m/report">
              <Button variant="secondary">
                <Sparkle className="h-4 w-4" />
                AI 报告
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => load()} disabled={loading}>
              <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              刷新
            </Button>
          </div>
        </div>

        {summary && (
          <div className="mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-7">
            {[
              ['党员数', `${summary.memberCount}`, Users],
              ['总学习时长', `${summary.durationHours}h`, Clock],
              ['人均时长', `${summary.avgDurationHours ?? 0}h`, Clock],
              ['任务完成率', `${summary.overallTaskCompletionRate}%`, CheckCircle],
              ['内容完成率', `${summary.contentCompletionRate}%`, CheckCircle],
              ['测验均分', `${summary.avgExamScore}`, ChartBar],
              ['通过率', `${summary.passRate}%`, Trophy],
            ].map(([label, value, Icon]) => {
              const I = Icon as typeof Users
              return (
                <div key={String(label)} className="panel-muted rounded-2xl px-4 py-4">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#9e1b2b]/60">
                    <I className="h-3.5 w-3.5" />
                    {label as string}
                  </div>
                  <div className="mt-3 text-2xl font-black tracking-[-0.05em] text-[#12151c]">
                    {value as string}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBar className="h-5 w-5 text-[#9e1b2b]" />
              支部总览指标
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary ? (
              <Chart option={overviewOption} height={300} />
            ) : (
              <div className="py-10 text-sm text-zinc-400">暂无数据</div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#9e1b2b]" />
              党员学习时长 Top10
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.members?.length ?? 0) > 0 ? (
              <Chart option={memberDurationOption} height={300} />
            ) : (
              <div className="py-10 text-sm text-zinc-400">暂无党员学习记录</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-[#9e1b2b]" weight="fill" />
              薄弱知识点
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.weakCategories?.length ?? 0) > 0 ? (
              <div className="grid gap-3">
                <div className="text-xs text-[rgba(18,21,28,0.5)]">
                  按本支部党员测验错题次数汇总，优先安排对应主题学习与讲评
                </div>
                {(data?.weakCategories ?? []).map((w, idx) => (
                  <div
                    key={w.category}
                    className="rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-[#12151c]">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(158,27,43,0.1)] text-[11px] font-semibold text-[#9e1b2b]">
                            {idx + 1}
                          </span>
                          {w.category}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          错 {w.wrongCount} 次 · 涉及 {w.memberCount} 人 · 占比 {w.sharePercent}%
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
                      <div
                        className="h-full rounded-full bg-[#9e1b2b]"
                        style={{ width: `${Math.min(100, Math.max(6, w.sharePercent))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-sm text-zinc-400">暂无错题数据，党员完成测验后将自动汇总</div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListBullets className="h-5 w-5 text-[#9e1b2b]" />
              错题 Top
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.wrongTop?.length ?? 0) > 0 ? (
              <div className="grid gap-2">
                <div className="text-xs text-[rgba(18,21,28,0.5)]">
                  本支部答错次数最多的题目，可用于集中讲解
                </div>
                {(data?.wrongTop ?? []).map((q, idx) => (
                  <div
                    key={q.questionId}
                    className="rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span className="font-semibold text-[#9e1b2b]">#{idx + 1}</span>
                          <span>{q.category}</span>
                          <span>·</span>
                          <span>{typeLabel[q.type] ?? q.type}</span>
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm text-[#12151c]">{q.stem}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-[#9e1b2b]">{q.wrongCount}</div>
                        <div className="text-[11px] text-zinc-500">次错 / {q.memberCount} 人</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-sm text-zinc-400">暂无高频错题</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>学习任务完成情况</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {(data?.tasks ?? []).map((t) => (
              <div key={t.id} className="list-surface">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#12151c]">{t.title}</div>
                    <div className="mt-1 text-xs text-[rgba(18,21,28,0.55)]">
                      内容 {t.contentCount} 项 · 已完成党员 {t.completedMemberCount}/{summary?.memberCount ?? 0}
                      {t.dueAt ? ` · 截止 ${new Date(t.dueAt).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[#9e1b2b]">{t.completionRate}%</div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full bg-[#9e1b2b]"
                    style={{ width: `${Math.min(100, Math.max(0, t.completionRate))}%` }}
                  />
                </div>
                {(t.pendingMembers?.length ?? 0) > 0 && (
                  <div className="mt-3 rounded-lg bg-[rgba(158,27,43,0.04)] px-3 py-2 text-xs text-[rgba(18,21,28,0.7)]">
                    <span className="font-medium text-[#9e1b2b]">未完成：</span>
                    {(t.pendingMembers ?? []).map((m) => m.name).join('、')}
                  </div>
                )}
              </div>
            ))}
            {(data?.tasks ?? []).length === 0 && (
              <div className="py-8 text-sm text-zinc-400">本支部暂无学习任务</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>党员学习与测验明细</CardTitle>
            <Link to="/m/scores" className="text-xs font-medium text-[#9e1b2b]">
              查看综合排行榜 →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {(data?.members ?? []).map((m) => (
              <Link
                key={m.userId}
                to={`/m/members/${m.userId}`}
                className="grid gap-3 rounded-2xl bg-white/90 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition hover:bg-[rgba(158,27,43,0.03)] md:grid-cols-5"
              >
                <div>
                  <div className="text-sm font-medium text-[#12151c]">{m.name}</div>
                  <div className="mt-1 text-xs text-[rgba(18,21,28,0.45)]">{m.username ? `@${m.username}` : m.userId}</div>
                </div>
                <div className="text-sm">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(18,21,28,0.4)]">学习时长</div>
                  <div className="mt-1 font-semibold text-[#12151c]">{m.durationHours} h</div>
                </div>
                <div className="text-sm">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(18,21,28,0.4)]">任务完成</div>
                  <div className="mt-1 font-semibold text-[#12151c]">
                    {m.taskCompletedCount}/{m.taskCount}
                    <span className="ml-1 text-xs font-normal text-[rgba(18,21,28,0.45)]">（{m.taskCompletionRate}%）</span>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(18,21,28,0.4)]">已完成内容</div>
                  <div className="mt-1 font-semibold text-[#12151c]">{m.completedContentCount}</div>
                </div>
                <div className="text-sm">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(18,21,28,0.4)]">测验均分</div>
                  <div className="mt-1 font-semibold text-[#12151c]">
                    {m.avgScore == null ? '-' : m.avgScore}
                    <span className="ml-1 text-xs font-normal text-[rgba(18,21,28,0.45)]">/ {m.attemptCount} 次</span>
                  </div>
                </div>
              </Link>
            ))}
            {(data?.members ?? []).length === 0 && (
              <div className="py-10 text-center text-sm text-[rgba(18,21,28,0.45)]">本支部暂无党员</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
