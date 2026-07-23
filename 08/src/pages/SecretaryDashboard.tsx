import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Chart } from '@/components/Chart'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  BarChart3,
  BookOpenCheck,
  Clock3,
  RotateCw,
  Trophy,
  Users,
} from 'lucide-react'
import type { EChartsOption } from 'echarts'

type BranchDashboard = {
  orgUnitId: string
  orgName: string
  summary: {
    memberCount: number
    durationHours: number
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
            color: 'rgba(163,24,40,0.85)',
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
          itemStyle: { color: 'rgba(163,24,40,0.75)', borderRadius: [0, 6, 6, 0] },
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
            <div className="page-eyebrow">Branch Dashboard</div>
            <h1 className="page-title text-3xl md:text-5xl">支部数据看板</h1>
            <div className="page-subtitle mt-2 max-w-2xl">
              汇总本支部学习时长、任务完成率与测验表现
              {data?.orgName ? `（${data.orgName}）` : ''}。
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/m/scores">
              <Button variant="secondary">
                <Trophy className="h-4 w-4" />
                成绩明细
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => load()} disabled={loading}>
              <RotateCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              刷新
            </Button>
          </div>
        </div>

        {summary && (
          <div className="mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              ['党员数', `${summary.memberCount}`, Users],
              ['学习时长', `${summary.durationHours}h`, Clock3],
              ['任务完成率', `${summary.overallTaskCompletionRate}%`, BookOpenCheck],
              ['内容完成率', `${summary.contentCompletionRate}%`, BookOpenCheck],
              ['测验均分', `${summary.avgExamScore}`, BarChart3],
              ['通过率', `${summary.passRate}%`, Trophy],
            ].map(([label, value, Icon]) => {
              const I = Icon as typeof Users
              return (
                <div key={String(label)} className="panel-muted rounded-2xl px-4 py-4">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-[#a31828]/60">
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
        <div className="rounded-2xl bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020] shadow-[inset_0_0_0_1px_rgba(163,24,40,0.16)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#a31828]" />
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
              <Clock3 className="h-5 w-5 text-[#a31828]" />
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
                    <div className="text-sm font-medium text-[#0e1116]">{t.title}</div>
                    <div className="mt-1 text-xs text-[rgba(14,17,22,0.55)]">
                      内容 {t.contentCount} 项 · 已完成党员 {t.completedMemberCount}/{summary?.memberCount ?? 0}
                      {t.dueAt ? ` · 截止 ${new Date(t.dueAt).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[#a31828]">{t.completionRate}%</div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full bg-[#a31828]"
                    style={{ width: `${Math.min(100, Math.max(0, t.completionRate))}%` }}
                  />
                </div>
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
          <CardTitle>党员学习与测验明细</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {(data?.members ?? []).map((m) => (
              <div
                key={m.userId}
                className="grid gap-3 rounded-2xl bg-white/90 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] md:grid-cols-5"
              >
                <div>
                  <div className="text-sm font-medium text-[#0e1116]">{m.name}</div>
                  <div className="mt-1 text-xs text-[rgba(14,17,22,0.45)]">{m.username ? `@${m.username}` : m.userId}</div>
                </div>
                <div className="text-sm">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(14,17,22,0.4)]">学习时长</div>
                  <div className="mt-1 font-semibold text-[#0e1116]">{m.durationHours} h</div>
                </div>
                <div className="text-sm">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(14,17,22,0.4)]">任务完成</div>
                  <div className="mt-1 font-semibold text-[#0e1116]">
                    {m.taskCompletedCount}/{m.taskCount}
                    <span className="ml-1 text-xs font-normal text-[rgba(14,17,22,0.45)]">（{m.taskCompletionRate}%）</span>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(14,17,22,0.4)]">已完成内容</div>
                  <div className="mt-1 font-semibold text-[#0e1116]">{m.completedContentCount}</div>
                </div>
                <div className="text-sm">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(14,17,22,0.4)]">测验均分</div>
                  <div className="mt-1 font-semibold text-[#0e1116]">
                    {m.avgScore == null ? '—' : m.avgScore}
                    <span className="ml-1 text-xs font-normal text-[rgba(14,17,22,0.45)]">/ {m.attemptCount} 次</span>
                  </div>
                </div>
              </div>
            ))}
            {(data?.members ?? []).length === 0 && (
              <div className="py-10 text-center text-sm text-[rgba(14,17,22,0.45)]">本支部暂无党员</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
