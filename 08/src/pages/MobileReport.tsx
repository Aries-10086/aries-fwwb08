import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Chart } from '@/components/Chart'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  Sparkle,
  ArrowsClockwise,
} from '@phosphor-icons/react'
import type { EChartsOption } from 'echarts'

type Report = {
  score: number
  level: string
  metrics: {
    durationHours: number
    completedCount: number
    avgExamScore: number
    passCount: number
  }
  ranking?: {
    branchRank: number | null
    branchMemberCount: number | null
  }
  comparison?: {
    myAvgExamScore: number | null
    branchAvgExamScore: number | null
    branchMaxExamScore: number | null
  }
  suggestions?: Array<{ contentId: string; title: string; reason: string }>
  parts?: {
    duration: number
    completed: number
    exam: number
  }
  comment: string
  degraded?: boolean
  degradedReason?: string | null
  generatedAt: string
}

export default function MobileReport() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) nav('/login')
  }, [nav, user])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Report>('/api/ai/report', { method: 'POST', body: JSON.stringify({ userId: user?.id }) })
      setReport(data)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const option = useMemo((): EChartsOption => {
    const m = report?.metrics
    const values = m ? [m.durationHours, m.completedCount, m.avgExamScore, m.passCount] : [0, 0, 0, 0]
    return {
      backgroundColor: 'transparent',
      grid: { left: 36, right: 18, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: ['学习时长', '完成条目', '测验均分', '通过次数'],
        axisLabel: { color: 'rgba(18,21,28,0.55)', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(18,21,28,0.12)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(18,21,28,0.45)', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(18,21,28,0.06)' } },
      },
      series: [
        {
          type: 'bar',
          data: values,
          itemStyle: {
            color: '#9e1b2b',
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    }
  }, [report])

  const badge = useMemo(() => {
    if (!report) return 'bg-[rgba(18,21,28,0.06)] text-[rgba(18,21,28,0.7)]'
    if (report.score >= 85) return 'bg-[#9e1b2b] text-white'
    if (report.score >= 70) return 'bg-[#8a6a2f] text-white'
    if (report.score >= 55) return 'bg-[rgba(18,21,28,0.06)] text-[rgba(18,21,28,0.7)]'
    return 'bg-rose-500/20 text-[#741220]'
  }, [report])

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">党员端</div>
          <h1 className="page-title text-3xl md:text-4xl">AI 综合评价报告</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/m/home">
            <Button variant="secondary">返回学习</Button>
          </Link>
          <Button variant="ghost" onClick={() => load()} disabled={loading}>
            <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <div className="border border-[rgba(158,27,43,0.2)] bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220]">
          {error}
        </div>
      )}
      {report?.degraded && (
        <div className="rounded-2xl bg-[rgba(138,106,47,0.12)] px-4 py-3 text-sm text-[#6b521f] shadow-[inset_0_0_0_1px_rgba(138,106,47,0.2)]">
          {report.degradedReason || '已使用离线评语 / 降级结果'}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Sparkle className="h-5 w-5 text-[#9e1b2b]" />
                综合评分
              </span>
              {report && (
                <span className={`rounded-full px-3 py-1 text-xs font-medium border border-[rgba(18,21,28,0.1)] ${badge}`}>
                  {report.level}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report ? (
              <div className="grid gap-4">
                <div className="flex items-end gap-3">
                  <div className="metric-value text-5xl text-[#12151c]">{report.score}</div>
                  <div className="pb-2 page-eyebrow">/ 100</div>
                </div>
                {report.ranking?.branchRank != null && (
                  <div className="list-surface flex items-center justify-between text-sm">
                    <span className="text-[rgba(18,21,28,0.55)]">支部个人排名</span>
                    <span className="font-semibold text-[#9e1b2b]">
                      第 {report.ranking.branchRank} / {report.ranking.branchMemberCount}
                    </span>
                  </div>
                )}
                {report.comparison && (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="list-surface py-2">
                      <div className="text-[rgba(18,21,28,0.45)]">我的均分</div>
                      <div className="mt-1 font-semibold">{report.comparison.myAvgExamScore ?? '-'}</div>
                    </div>
                    <div className="list-surface py-2">
                      <div className="text-[rgba(18,21,28,0.45)]">支部均分</div>
                      <div className="mt-1 font-semibold">{report.comparison.branchAvgExamScore ?? '-'}</div>
                    </div>
                    <div className="list-surface py-2">
                      <div className="text-[rgba(18,21,28,0.45)]">支部最高</div>
                      <div className="mt-1 font-semibold">{report.comparison.branchMaxExamScore ?? '-'}</div>
                    </div>
                  </div>
                )}
                {(report.suggestions?.length ?? 0) > 0 && (
                  <div className="grid gap-2">
                    <div className="text-xs font-medium text-[rgba(18,21,28,0.55)]">可执行建议</div>
                    {report.suggestions!.map((s) => (
                      <Link
                        key={s.contentId}
                        to={`/m/content/${s.contentId}`}
                        className="list-surface flex items-center justify-between text-sm hover:bg-[rgba(158,27,43,0.05)]"
                      >
                        <div>
                          <div className="font-medium text-[#12151c]">{s.title}</div>
                          <div className="mt-0.5 text-xs text-[rgba(18,21,28,0.45)]">{s.reason}</div>
                        </div>
                        <span className="text-[#9e1b2b]">去学习</span>
                      </Link>
                    ))}
                  </div>
                )}
                {report.parts && (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="list-surface py-2">
                      <div className="text-[rgba(18,21,28,0.45)]">时长分</div>
                      <div className="mt-1 font-semibold">{report.parts.duration}/20</div>
                    </div>
                    <div className="list-surface py-2">
                      <div className="text-[rgba(18,21,28,0.45)]">完成分</div>
                      <div className="mt-1 font-semibold">{report.parts.completed}/20</div>
                    </div>
                    <div className="list-surface py-2">
                      <div className="text-[rgba(18,21,28,0.45)]">测验分</div>
                      <div className="mt-1 font-semibold">{report.parts.exam}/60</div>
                    </div>
                  </div>
                )}
                <div className="list-surface text-sm leading-relaxed text-[rgba(18,21,28,0.75)]">
                  {report.comment}
                </div>
                <div className="text-xs text-[rgba(18,21,28,0.45)]">生成时间：{new Date(report.generatedAt).toLocaleString()}</div>
              </div>
            ) : (
              <div className="py-10 page-eyebrow">生成中…</div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle>数据摘要</CardTitle>
          </CardHeader>
          <CardContent>
            <Chart option={option} height={320} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

