import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Chart } from '@/components/Chart'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { BrainCircuit, Loader2, Sparkles } from 'lucide-react'
import type { EChartsOption } from 'echarts'

type QueryResult = {
  text: string
  chart: { xAxis: string[]; values: number[]; unit: string; metric: string }
}

export default function AdminAIQuery() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [question, setQuestion] = useState('今年三支部学习完成率')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QueryResult | null>(null)

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  async function query() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<QueryResult>('/api/ai/query', {
        method: 'POST',
        body: JSON.stringify({ question }),
      })
      setResult(data)
    } catch (e: any) {
      setError(e?.message ?? '查询失败')
    } finally {
      setLoading(false)
    }
  }

  const option = useMemo((): EChartsOption => {
    if (!result) return {}
    return {
      backgroundColor: 'transparent',
      grid: { left: 40, right: 18, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: result.chart.xAxis,
        axisLabel: { color: 'rgba(228,228,231,0.75)', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.10)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(228,228,231,0.55)', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params?.[0]
          if (!p) return ''
          return `${p.axisValue}<br/>${p.data}${result.chart.unit}`
        },
      },
      series: [
        {
          type: 'bar',
          data: result.chart.values,
          itemStyle: {
            color: 'rgba(140,36,36,0.82)',
            borderRadius: [8, 8, 0, 0],
            shadowColor: 'rgba(140,36,36,0.18)',
            shadowBlur: 16,
          },
        },
      ],
    }
  }, [result])

  return (
    <div className="grid gap-6">
      <div className="hero-frame px-6 py-7 md:px-8">
        <div className="page-eyebrow">AI 查询</div>
        <h1 className="page-title text-3xl md:text-5xl">自然语言数据查询</h1>
        <div className="page-subtitle mt-2 max-w-2xl">用一句自然语言直接提问组织运营数据，由系统自动生成解释文本和图表，减少后台统计的切换成本。</div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[#a31828]/10 px-4 py-3 text-[#7a1020] shadow-[inset_0_0_0_1px_rgba(185,28,28,0.16)]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-[#a31828]" />
            提问
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="input-shell"
              placeholder="例如：今年三支部学习完成率 / 各支部测验平均分 / 学习时长统计"
            />
            <div className="flex flex-wrap gap-2">
              {['今年三支部学习完成率', '各支部测验平均分', '各支部考试通过率', '学习时长统计'].map((t) => (
                <button
                  key={t}
                  onClick={() => setQuestion(t)}
                  className="data-pill hover:bg-[#a31828]/10"
                >
                  {t}
                </button>
              ))}
            </div>
            <Button onClick={() => query()} disabled={loading || !question.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  查询中…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  查询
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="grid gap-4 md:grid-cols-12">
          <Card className="md:col-span-5">
            <CardHeader>
              <CardTitle>结论</CardTitle>
            </CardHeader>
            <CardContent>
            <div className="list-surface text-sm leading-relaxed text-black/75">
                {result.text}
              </div>
            </CardContent>
          </Card>
          <Card className="md:col-span-7">
            <CardHeader>
              <CardTitle>图表</CardTitle>
            </CardHeader>
            <CardContent>
              <Chart option={option} height={320} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
