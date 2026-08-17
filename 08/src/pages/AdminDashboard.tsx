import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import Empty from '@/components/Empty'
import { Chart } from '@/components/Chart'
import { RankBadge } from '@/components/RankBadge'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ChartBar,
  ArrowsClockwise,
  Sparkle,
  CaretRight,
  Users,
  X,
} from '@phosphor-icons/react'
import type { EChartsOption } from 'echarts'

type Org = { id: string; name: string; parentId: string | null }
type MemberRankRow = {
  userId: string
  name: string
  username?: string
  orgUnitId: string
  orgName: string
  rank: number
  score: number
  level: string
  durationHours: number
  completedContentCount: number
  avgExamScore: number | null
  attemptCount?: number
  passRate?: number | null
}
type Overview = {
  orgUnitId: string | null
  range: string
  rangeLabel: string
  memberCount: number
  durationHours: number
  avgExamScore: number
  passRate: number
  latestTaskCompletionRate: number
  rank: { orgUnitId: string; orgName: string; avgScore: number; attemptCount?: number }[]
  memberRank: MemberRankRow[]
}

type RangeKey = 'all' | 'month' | 'quarter' | 'year'

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: 'all', label: '全部时间' },
  { value: 'month', label: '本月' },
  { value: 'quarter', label: '本季' },
  { value: 'year', label: '今年' },
]

export default function AdminDashboard() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orgUnitId, setOrgUnitId] = useState('')
  const [range, setRange] = useState<RangeKey>('all')
  const [drillOrgId, setDrillOrgId] = useState<string | null>(null)

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
      if (range && range !== 'all') query.set('range', range)
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
  }, [orgUnitId, range])

  const drillOrgName = useMemo(() => {
    if (!drillOrgId) return ''
    return orgs.find((o) => o.id === drillOrgId)?.name || data?.rank.find((r) => r.orgUnitId === drillOrgId)?.orgName || ''
  }, [drillOrgId, orgs, data])

  const drillMembers = useMemo(() => {
    if (!drillOrgId || !data?.memberRank) return []
    // 若当前已筛选到该支部，直接用 memberRank；否则按 orgUnitId 过滤（全部支部视图时 overview 返回全量 memberRank）
    return data.memberRank.filter((m) => m.orgUnitId === drillOrgId)
  }, [drillOrgId, data])

  function drillIntoBranch(id: string) {
    setDrillOrgId(id)
    setOrgUnitId(id)
  }

  function clearDrill() {
    setDrillOrgId(null)
    setOrgUnitId('')
  }

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
    <div className="grid gap-4">
      <nav className="text-sm text-[rgba(18,21,28,0.45)]">
        <Link to="/" className="hover:text-[#9e1b2b]">
          首页
        </Link>
        <span className="mx-1.5">/</span>
        <span>管理后台</span>
        <span className="mx-1.5">/</span>
        <span className="text-[#12151c]">统计看板</span>
      </nav>

      <div className="border border-[#e8ecf1] bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[#12151c]">统计看板</h1>
            {data && (
              <div className="mt-1 text-xs text-[rgba(18,21,28,0.5)]">
                当前范围：{data.rangeLabel}
                {orgUnitId ? ` / ${orgs.find((o) => o.id === orgUnitId)?.name ?? '所选支部'}` : ' / 全部支部'}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/admin/exams">
              <Button variant="secondary">新建测验</Button>
            </Link>
            <Link to="/admin/tasks">
              <Button variant="secondary">派发任务</Button>
            </Link>
            <select
              value={orgUnitId}
              onChange={(e) => {
                const v = e.target.value
                setOrgUnitId(v)
                setDrillOrgId(v || null)
              }}
              className="input-shell min-w-[160px]"
            >
              <option value="">全部支部</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              className="input-shell min-w-[120px]"
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
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
          <div className="mt-4 grid grid-cols-2 divide-x divide-[#e8ecf1] border-t border-[#e8ecf1] md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-4">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton mt-3 h-7 w-20" />
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="mt-4 grid grid-cols-2 divide-x divide-[#e8ecf1] border-t border-[#e8ecf1] md:grid-cols-4">
            {[
              ['成员规模', `${data.memberCount}`],
              ['学习时长', `${data.durationHours}h`],
              ['测验均分', `${data.avgExamScore}`],
              ['通过率', `${data.passRate}%`],
            ].map(([label, value]) => (
              <div key={label} className="px-4 py-4">
                <div className="text-sm text-[rgba(18,21,28,0.5)]">{label}</div>
                <div className="metric-value mt-1">{value}</div>
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
            <div className="mb-2 text-xs text-[rgba(18,21,28,0.45)]">点击支部可下钻查看党员明细</div>
            {loading && !data ? (
              <div className="grid gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-14 w-full" />
                ))}
              </div>
            ) : data ? (
              <div className="grid gap-2">
                {data.rank.map((r) => (
                  <button
                    key={r.orgUnitId}
                    type="button"
                    onClick={() => drillIntoBranch(String(r.orgUnitId))}
                    className={[
                      'list-surface flex w-full items-center justify-between gap-3 text-left transition hover:bg-[rgba(158,27,43,0.04)]',
                      drillOrgId === r.orgUnitId ? 'ring-1 ring-[#9e1b2b]/40' : '',
                    ].join(' ')}
                  >
                    <div>
                      <div className="flex items-center gap-1 text-sm font-medium text-[#12151c]">
                        {r.orgName}
                        <CaretRight className="h-3.5 w-3.5 text-[rgba(18,21,28,0.35)]" />
                      </div>
                      <div className="mt-1 text-xs text-[rgba(18,21,28,0.55)]">
                        点击下钻党员 · {r.attemptCount ?? 0} 次作答
                      </div>
                    </div>
                    <div className="font-serif text-lg font-bold tabular-nums text-[#9e1b2b]">{r.avgScore}</div>
                  </button>
                ))}
                {data.rank.length === 0 && (
                  <Empty title="暂无排行" description="当前时间范围内暂无测验数据。" />
                )}
              </div>
            ) : (
              <Empty title="暂无数据" description="选择支部或刷新后查看排行。" />
            )}
          </CardContent>
        </Card>
      </div>

      {drillOrgId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#9e1b2b]" weight="duotone" />
                下钻：{drillOrgName || '支部'}党员明细
              </span>
              <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={clearDrill}>
                <X className="h-3.5 w-3.5" />
                返回全部
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 text-xs text-[rgba(18,21,28,0.5)]">
              时间范围：{data?.rangeLabel ?? RANGE_OPTIONS.find((r) => r.value === range)?.label}
              ；按综合评价排序
            </div>
            {loading ? (
              <div className="grid gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-14 w-full" />
                ))}
              </div>
            ) : drillMembers.length > 0 ? (
              <div className="grid gap-2">
                {drillMembers.map((m) => (
                  <div key={m.userId} className="list-surface flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <RankBadge rank={m.rank} size="sm" />
                      <div>
                        <div className="text-sm font-medium text-[#12151c]">{m.name}</div>
                        <div className="mt-1 text-xs text-[rgba(18,21,28,0.55)]">
                          {m.username ? `@${m.username} · ` : ''}
                          时长 {m.durationHours}h · 完成 {m.completedContentCount} · 均分 {m.avgExamScore ?? '-'}
                          {m.attemptCount != null ? ` · ${m.attemptCount} 次` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-lg font-bold tabular-nums text-[#9e1b2b]">{m.score}</div>
                      <div className="text-[11px] text-[rgba(18,21,28,0.5)]">{m.level}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="该支部暂无党员数据" description="当前时间范围内无学习或测验记录。" />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkle className="h-5 w-5 text-[#9e1b2b]" weight="duotone" />
            党员综合评价排行
            {orgUnitId ? `（${orgs.find((o) => o.id === orgUnitId)?.name ?? '支部'}）` : '（全部）'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 text-xs text-[rgba(18,21,28,0.5)]">
            综合分 = 学习时长（≤20）+ 完成内容（≤20）+ 测验均分×0.6（≤60）；已按时间范围过滤
          </div>
          {loading && !data ? (
            <div className="grid gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-14 w-full" />
              ))}
            </div>
          ) : data && data.memberRank?.length > 0 ? (
            <div className="grid gap-2">
              {data.memberRank.slice(0, 15).map((m) => (
                <div key={m.userId} className="list-surface flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <RankBadge rank={m.rank} size="sm" />
                    <div>
                      <div className="text-sm font-medium text-[#12151c]">{m.name}</div>
                      <div className="mt-1 text-xs text-[rgba(18,21,28,0.55)]">
                        {m.orgName || '未分配支部'} · 时长 {m.durationHours}h · 完成 {m.completedContentCount} · 均分{' '}
                        {m.avgExamScore ?? '-'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-lg font-bold tabular-nums text-[#9e1b2b]">{m.score}</div>
                    <div className="text-[11px] text-[rgba(18,21,28,0.5)]">{m.level}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="暂无个人排行" description="当前筛选下暂无党员学习或测验数据。" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
