import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'

type Member = {
  userId: string
  name: string
  evalRank?: number | null
  evalScore?: number
  avgScore: number | null
  attemptCount: number
  latestScore: number | null
  latestIsPass: boolean | null
}

type ScoresData = {
  orgName: string
  summary: { memberCount: number; attemptedMemberCount: number; avgScore: number; passRate: number }
  members: Member[]
}

type ExamRow = {
  examId: string
  title: string
  attemptedCount: number
  memberCount: number
  notAttempted: Array<{ name: string }>
  avgScore: number
}

export default function Scores() {
  const { user } = useAuthStore()
  const nav = useNavigate()
  const [data, setData] = useState<ScoresData | null>(null)
  const [exams, setExams] = useState<ExamRow[]>([])
  const [tab, setTab] = useState<'rank' | 'exams'>('rank')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user && user.role !== 'secretary' && user.role !== 'admin') nav('/home', { replace: true })
  }, [user, nav])

  useEffect(() => {
    void (async () => {
      try {
        const [scores, branchExams] = await Promise.all([
          apiFetch<ScoresData>('/api/stats/member-scores'),
          apiFetch<{ exams: ExamRow[] }>('/api/stats/branch-exams'),
        ])
        setData(scores)
        setExams(branchExams.exams ?? [])
      } catch (e: any) {
        setError(e?.message ?? '加载失败')
      }
    })()
  }, [])

  return (
    <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
      <h1 className="pt-2 text-2xl font-bold">支部成绩</h1>
      <p className="mt-1 text-sm text-ink/50">{data?.orgName ?? ''}</p>
      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}

      {data && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            ['党员', data.summary.memberCount],
            ['已参考', data.summary.attemptedMemberCount],
            ['均分', data.summary.avgScore],
            ['通过率', `${data.summary.passRate}%`],
          ].map(([k, v]) => (
            <div key={String(k)} className="m-card p-3">
              <div className="text-[11px] text-ink/40">{k}</div>
              <div className="mt-1 text-lg font-bold">{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm ${tab === 'rank' ? 'bg-seal text-white' : 'm-card'}`}
          onClick={() => setTab('rank')}
        >
          综合排行
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm ${tab === 'exams' ? 'bg-seal text-white' : 'm-card'}`}
          onClick={() => setTab('exams')}
        >
          各次测验
        </button>
      </div>

      {tab === 'rank' && (
        <div className="mt-3 grid gap-2">
          {(data?.members ?? []).map((m) => (
            <div key={m.userId} className="m-card flex items-center gap-3 p-3">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-seal/10 text-xs font-bold text-seal">
                {m.evalRank ?? '-'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{m.name}</div>
                <div className="text-xs text-ink/45">
                  综合 {m.evalScore ?? 0} · 均分 {m.avgScore ?? '-'} / {m.attemptCount} 次
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'exams' && (
        <div className="mt-3 grid gap-3">
          {exams.map((e) => (
            <div key={e.examId} className="m-card p-4">
              <div className="text-sm font-semibold">{e.title}</div>
              <div className="mt-1 text-xs text-ink/45">
                参考 {e.attemptedCount}/{e.memberCount} · 均分 {e.avgScore}
              </div>
              {e.notAttempted.length > 0 && (
                <div className="mt-2 rounded-lg bg-seal/5 px-3 py-2 text-xs text-seal-deep">
                  未参与：{e.notAttempted.map((m) => m.name).join('、')}
                </div>
              )}
            </div>
          ))}
          {exams.length === 0 && <div className="py-8 text-center text-sm text-ink/40">暂无测验</div>}
        </div>
      )}
    </div>
  )
}
