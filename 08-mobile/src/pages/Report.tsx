import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ArrowsClockwise } from '@phosphor-icons/react'

type Report = {
  score: number
  level: string
  metrics: {
    durationHours: number
    completedCount: number
    avgExamScore: number
    passCount: number
  }
  ranking?: { branchRank: number | null; branchMemberCount: number | null }
  comparison?: {
    myAvgExamScore: number | null
    branchAvgExamScore: number | null
    branchMaxExamScore: number | null
  }
  suggestions?: Array<{ contentId: string; title: string; reason: string }>
  comment: string
  degraded?: boolean
  degradedReason?: string | null
}

export default function Report() {
  const { user } = useAuthStore()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Report>('/api/ai/report', {
        method: 'POST',
        body: JSON.stringify({ userId: user?.id }),
      })
      setReport(data)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
      <div className="flex items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl font-bold">AI 报告</h1>
          <p className="mt-1 text-sm text-ink/50">学习综合评价</p>
        </div>
        <Button variant="ghost" className="!min-h-9 px-3" disabled={loading} onClick={() => void load()}>
          <ArrowsClockwise className={loading ? 'animate-spin' : ''} size={16} />
        </Button>
      </div>
      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}
      {report?.degraded && (
        <div className="mt-3 rounded-xl bg-[#8a6a2f]/15 px-3 py-2 text-xs text-[#6b5320]">
          {report.degradedReason || '已使用离线评语 / 降级结果'}
        </div>
      )}
      {report && (
        <>
          <div className="m-card mt-4 p-5 text-center">
            <div className="text-xs text-ink/45">综合分</div>
            <div className="mt-1 text-4xl font-black text-seal">{report.score}</div>
            <div className="mt-1 text-sm font-medium text-ink">{report.level}</div>
            {report.ranking?.branchRank != null && (
              <div className="mt-2 text-xs text-ink/45">
                支部排名 {report.ranking.branchRank}
                {report.ranking.branchMemberCount != null ? ` / ${report.ranking.branchMemberCount}` : ''}
              </div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ['学习时长', `${report.metrics.durationHours}h`],
              ['完成内容', `${report.metrics.completedCount}`],
              ['测验均分', `${report.metrics.avgExamScore}`],
              ['通过次数', `${report.metrics.passCount}`],
            ].map(([k, v]) => (
              <div key={k} className="m-card p-3">
                <div className="text-[11px] text-ink/40">{k}</div>
                <div className="mt-1 text-lg font-bold">{v}</div>
              </div>
            ))}
          </div>
          {report.comparison && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ['我的均分', report.comparison.myAvgExamScore],
                ['支部均分', report.comparison.branchAvgExamScore],
                ['支部最高', report.comparison.branchMaxExamScore],
              ].map(([k, v]) => (
                <div key={String(k)} className="m-card py-3">
                  <div className="text-[10px] text-ink/40">{k}</div>
                  <div className="mt-1 text-sm font-bold">{v ?? '—'}</div>
                </div>
              ))}
            </div>
          )}
          {(report.suggestions?.length ?? 0) > 0 && (
            <div className="mt-3 grid gap-2">
              <div className="text-xs font-medium text-ink/45">可执行建议</div>
              {report.suggestions!.map((s) => (
                <Link key={s.contentId} to={`/content/${s.contentId}`} className="m-card p-3">
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="mt-0.5 text-xs text-ink/45">{s.reason}</div>
                </Link>
              ))}
            </div>
          )}
          <div className="m-card mt-3 p-4 text-sm leading-7 text-ink/75 whitespace-pre-wrap">{report.comment}</div>
        </>
      )}
      {!report && !error && <div className="py-16 text-center text-sm text-ink/40">生成中…</div>}
    </div>
  )
}
