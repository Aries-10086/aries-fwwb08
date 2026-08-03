import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Chart } from '@/components/Chart'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  Brain,
  CircleNotch,
  Sparkle,
} from '@phosphor-icons/react'
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
    const { xAxis, values, unit, metric } = result.chart
    const axisColor = 'rgba(18,21,28,0.55)'
    const mutedAxis = 'rgba(18,21,28,0.45)'
    const lineColor = 'rgba(18,21,28,0.12)'
    const splitColor = 'rgba(18,21,28,0.06)'
    const brand = '#9e1b2b'

    // 单点数据用仪表盘，避免「一根柱子」的柱状图
    if (values.length <= 1) {
      const value = values[0] ?? 0
      const label = xAxis[0] ?? '当前'
      const isRateOrScore =
        unit === '%' || metric === 'avg_score' || metric === 'pass_rate' || metric === 'completion_rate'
      const max = isRateOrScore ? 100 : Math.max(Math.ceil(value * 1.4), 10)
      return {
        backgroundColor: 'transparent',
        series: [
          {
            type: 'gauge',
            startAngle: 210,
            endAngle: -30,
            min: 0,
            max,
            splitNumber: 5,
            radius: '90%',
            center: ['50%', '58%'],
            axisLine: {
              lineStyle: {
                width: 14,
                color: [
                  [0.3, 'rgba(158,27,43,0.25)'],
                  [0.7, 'rgba(158,27,43,0.55)'],
                  [1, brand],
                ],
              },
            },
            pointer: {
              length: '62%',
              width: 5,
              itemStyle: { color: brand },
            },
            axisTick: { distance: -14, length: 6, lineStyle: { color: lineColor, width: 1 } },
            splitLine: { distance: -18, length: 12, lineStyle: { color: lineColor, width: 2 } },
            axisLabel: { color: mutedAxis, fontSize: 11, distance: 18 },
            anchor: {
              show: true,
              size: 12,
              itemStyle: { borderWidth: 3, borderColor: brand, color: '#fff' },
            },
            title: {
              offsetCenter: [0, '72%'],
              color: axisColor,
              fontSize: 13,
            },
            detail: {
              valueAnimation: true,
              offsetCenter: [0, '42%'],
              formatter: (v: number) => `${v}${unit}`,
              color: '#12151c',
              fontSize: 28,
              fontWeight: 600,
            },
            data: [{ value, name: label }],
          },
        ],
      }
    }

    return {
      backgroundColor: 'transparent',
      grid: { left: 40, right: 18, top: 28, bottom: 36 },
      xAxis: {
        type: 'category',
        data: xAxis,
        axisLabel: { color: axisColor, fontSize: 11, interval: 0, rotate: xAxis.length > 4 ? 18 : 0 },
        axisLine: { lineStyle: { color: lineColor } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: mutedAxis,
          fontSize: 11,
          formatter: (v: number) => `${v}${unit === '%' ? '%' : ''}`,
        },
        splitLine: { lineStyle: { color: splitColor } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: 'rgba(18,21,28,0.08)',
        textStyle: { color: '#12151c', fontSize: 12 },
        formatter: (params: any) => {
          const p = params?.[0]
          if (!p) return ''
          return `${p.axisValue}<br/>${p.data}${unit}`
        },
      },
      series: [
        {
          type: 'bar',
          data: values,
          barMaxWidth: 48,
          itemStyle: {
            color: brand,
            borderRadius: [6, 6, 0, 0],
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
      </div>

      {error && (
        <div className="rounded-2xl bg-[#9e1b2b]/10 px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(185,28,28,0.16)]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-[#9e1b2b]" />
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
                  className="data-pill hover:bg-[#9e1b2b]/10"
                >
                  {t}
                </button>
              ))}
            </div>
            <Button onClick={() => query()} disabled={loading || !question.trim()}>
              {loading ? (
                <>
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  查询中…
                </>
              ) : (
                <>
                  <Sparkle className="h-4 w-4" />
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
