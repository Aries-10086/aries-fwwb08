import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Chart } from '@/components/Chart'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { Sparkles, RotateCw } from 'lucide-react'
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
  comment: string
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
        axisLabel: { color: 'rgba(228,228,231,0.8)', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.10)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(228,228,231,0.6)', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [
        {
          type: 'bar',
          data: values,
          itemStyle: {
            color: 'rgba(252,211,77,0.90)',
            borderRadius: [8, 8, 0, 0],
            shadowColor: 'rgba(252,211,77,0.18)',
            shadowBlur: 16,
          },
        },
      ],
    }
  }, [report])

  const badge = useMemo(() => {
    if (!report) return 'bg-white/10 text-zinc-200'
    if (report.score >= 85) return 'bg-amber-300/90 text-zinc-950'
    if (report.score >= 70) return 'bg-cyan-300/90 text-zinc-950'
    if (report.score >= 55) return 'bg-white/10 text-zinc-200'
    return 'bg-rose-500/20 text-rose-200'
  }, [report])

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-400">党员端</div>
          <h1 className="mt-2 text-2xl font-[850] tracking-[-0.05em] text-zinc-50">AI 综合评价报告</h1>
          <div className="mt-2 text-sm text-zinc-300/90">评分 + 评语 + 改进建议</div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/m/home">
            <Button variant="secondary">返回学习</Button>
          </Link>
          <Button variant="ghost" onClick={() => load()} disabled={loading}>
            <RotateCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-500/10 px-4 py-3 text-rose-200 shadow-[0_0_0_1px_rgba(244,63,94,0.25)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-200/90" />
                综合评分
              </span>
              {report && (
                <span className={`rounded-full px-3 py-1 text-xs font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] ${badge}`}>
                  {report.level}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report ? (
              <div className="grid gap-4">
                <div className="flex items-end gap-3">
                  <div className="text-5xl font-[900] tracking-[-0.06em] text-zinc-50">{report.score}</div>
                  <div className="pb-2 text-sm text-zinc-400">/ 100</div>
                </div>
                <div className="rounded-lg bg-white/5 px-4 py-3 text-sm text-zinc-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] leading-relaxed">
                  {report.comment}
                </div>
                <div className="text-xs text-zinc-500">生成时间：{new Date(report.generatedAt).toLocaleString()}</div>
              </div>
            ) : (
              <div className="py-10 text-sm text-zinc-400">生成中…</div>
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

