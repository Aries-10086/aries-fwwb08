import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Chart } from '@/components/Chart'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { BarChart3, RotateCw, Sparkles } from 'lucide-react'
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
            color: '#a31828',
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
              <RotateCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              刷新
            </Button>
          </div>
        </div>
        {data && (
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              ['成员规模', `${data.memberCount}`],
              ['学习时长', `${data.durationHours}h`],
              ['测验均分', `${data.avgExamScore}`],
              ['通过率', `${data.passRate}%`],
            ].map(([label, value]) => (
              <div key={label} className="panel-muted px-4 py-4">
                <div className="text-[11px] tracking-[0.2em] text-[#a31828]">{label}</div>
                <div className="metric-value mt-3 text-[#0e1116]">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="border border-[rgba(163,24,40,0.2)] bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#a31828]" />
              总览指标
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data ? <Chart option={option} height={320} /> : <div className="py-10 text-sm text-[rgba(14,17,22,0.4)]">暂无数据</div>}
          </CardContent>
        </Card>

        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#a31828]" />
              支部测验均分排行
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data ? (
              <div className="grid gap-2">
                {data.rank.map((r) => (
                  <div key={r.orgUnitId} className="list-surface flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#0e1116]">{r.orgName}</div>
                      <div className="mt-1 text-xs text-[rgba(14,17,22,0.55)]">支部综合表现</div>
                    </div>
                    <div className="font-serif text-lg font-bold text-[#a31828]">{r.avgScore}</div>
                  </div>
                ))}
                {data.rank.length === 0 && (
                  <div className="py-8 text-sm text-[rgba(14,17,22,0.4)]">暂无排行数据（先完成测验）</div>
                )}
              </div>
            ) : (
              <div className="py-10 text-sm text-[rgba(14,17,22,0.4)]">暂无数据</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
