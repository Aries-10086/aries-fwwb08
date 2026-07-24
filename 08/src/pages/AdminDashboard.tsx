import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import Empty from '@/components/Empty'
import { Chart } from '@/components/Chart'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ChartBar,
  ArrowsClockwise,
  Sparkle,
} from '@phosphor-icons/react'
import type { EChartsOption } from 'echarts'

type Org = { id: string; name: string; parentId: string | null }
type Overview = {
  orgUnitId: string | null
  memberCount: number
  durationHours: number
  avgExamScore: number
  passRate: number
  latestTaskCompletionRate: number
  rank: { orgUnitId: string; orgName: string; avgScore: number }[]
}

export default function AdminDashboard() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orgUnitId, setOrgUnitId] = useState('')

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  async function loadOrgs() {
    try {
      const items = await apiFetch<Org[]>('/api/org-units')
      setOrgs(items.filter((item) => item.parentId))
    } catch {
      null
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      if (orgUnitId) query.set('orgUnitId', orgUnitId)
      const res = await apiFetch<Overview>(`/api/stats/overview${query.size ? `?${query.toString()}` : ''}`)
      setData(res)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrgs()
  }, [])

  useEffect(() => {
    load()
  }, [orgUnitId])

  const option = useMemo((): EChartsOption => {
    const d = data
    if (!d) return {}
    return {
      backgroundColor: 'transparent',
      grid: { left: 40, right: 18, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: ['学习时长(小时)', '任务完成率(%)', '测验均分', '通过率(%)'],
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
          data: [d.durationHours, d.latestTaskCompletionRate, d.avgExamScore, d.passRate],
          itemStyle: {
            color: '#9e1b2b',
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    }
  }, [data])

  return (
    <div className="grid gap-6">
      <div className="hero-frame px-6 py-7 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="page-eyebrow">管理中枢</div>
            <h1 className="page-title text-3xl md:text-4xl">统计看板</h1>
            <div className="page-subtitle mt-2 max-w-2xl">
              学习、任务与测验数据统一沉淀，为组织管理提供持续可读的视角。
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} className="input-shell min-w-[180px]">
              <option value="">全部支部</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={() => load()} disabled={loading}>
              <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              刷新
            </Button>
          </div>
        </div>
        {loading && !data ? (
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="panel-muted px-4 py-4">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton mt-4 h-8 w-24" />
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              ['成员规模', `${data.memberCount}`],
              ['学习时长', `${data.durationHours}h`],
              ['测验均分', `${data.avgExamScore}`],
              ['通过率', `${data.passRate}%`],
            ].map(([label, value]) => (
              <div key={label} className="panel-muted px-4 py-4">
                <div className="text-[11px] tracking-[0.16em] text-[#9e1b2b]">{label}</div>
                <div className="metric-value mt-3 text-[#12151c]">{value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {error && (
        <div role="alert" className="border border-[rgba(158,27,43,0.2)] bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBar className="h-5 w-5 text-[#9e1b2b]" weight="duotone" />
              总览指标
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <div className="skeleton h-[320px] w-full" />
            ) : data ? (
              <Chart option={option} height={320} />
            ) : (
              <Empty title="暂无指标" description="还没有可汇总的学习与测验数据。" />
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkle className="h-5 w-5 text-[#9e1b2b]" weight="duotone" />
              支部测验均分排行
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <div className="grid gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-14 w-full" />
                ))}
              </div>
            ) : data ? (
              <div className="grid gap-2">
                {data.rank.map((r) => (
                  <div key={r.orgUnitId} className="list-surface flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#12151c]">{r.orgName}</div>
                      <div className="mt-1 text-xs text-[rgba(18,21,28,0.55)]">支部综合表现</div>
                    </div>
                    <div className="font-serif text-lg font-bold tabular-nums text-[#9e1b2b]">{r.avgScore}</div>
                  </div>
                ))}
                {data.rank.length === 0 && (
                  <Empty title="暂无排行" description="完成测验后，支部均分排行会出现在这里。" />
                )}
              </div>
            ) : (
              <Empty title="暂无数据" description="选择支部或刷新后查看排行。" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
