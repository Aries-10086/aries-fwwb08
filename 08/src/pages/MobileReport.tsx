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
        axisLabel: { color: 'rgba(14,17,22,0.55)', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(14,17,22,0.12)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(14,17,22,0.45)', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(14,17,22,0.06)' } },
      },
      series: [
        {
          type: 'bar',
          data: values,
          itemStyle: {
            color: '#a31828',
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    }
  }, [report])

  const badge = useMemo(() => {
    if (!report) return 'bg-[rgba(14,17,22,0.06)] text-[rgba(14,17,22,0.7)]'
    if (report.score >= 85) return 'bg-[#a31828] text-white'
    if (report.score >= 70) return 'bg-[#8a6a2f] text-white'
    if (report.score >= 55) return 'bg-[rgba(14,17,22,0.06)] text-[rgba(14,17,22,0.7)]'
    return 'bg-rose-500/20 text-[#7a1020]'
  }, [report])

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">党员端</div>
          <h1 className="page-title text-3xl md:text-4xl">AI 综合评价报告</h1>
          <div className="page-subtitle mt-2">评分 + 评语 + 改进建议</div>
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
        <div className="border border-[rgba(163,24,40,0.2)] bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#a31828]" />
                综合评分
              </span>
              {report && (
                <span className={`rounded-full px-3 py-1 text-xs font-medium border border-[rgba(14,17,22,0.1)] ${badge}`}>
                  {report.level}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report ? (
              <div className="grid gap-4">
                <div className="flex items-end gap-3">
                  <div className="metric-value text-5xl text-[#0e1116]">{report.score}</div>
                  <div className="pb-2 page-eyebrow">/ 100</div>
                </div>
                <div className="list-surface text-sm leading-relaxed text-[rgba(14,17,22,0.75)]">
                  {report.comment}
                </div>
                <div className="text-xs text-[rgba(14,17,22,0.45)]">生成时间：{new Date(report.generatedAt).toLocaleString()}</div>
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

