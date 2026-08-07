import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'

type Exam = {
  id: string
  title: string
  durationMin: number
  passScore: number
  remainingAttempts: number
  canAttempt: boolean
  bestScore: number | null
  type?: 'quiz' | 'formal'
}

type HistoryItem = {
  id: string
  examTitle: string
  totalScore: number
  isPass: boolean
  createdAt: string
}

export default function Exams() {
  const [items, setItems] = useState<Exam[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [exams, hist] = await Promise.all([
          apiFetch<Exam[]>('/api/exams'),
          apiFetch<HistoryItem[]>('/api/exams/attempts/mine'),
        ])
        setItems(exams)
        setHistory(hist)
      } catch (e: any) {
        setError(e?.message ?? '加载失败')
      }
    })()
  }, [])

  return (
    <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
      <h1 className="pt-2 text-2xl font-bold text-ink">测验</h1>
      <p className="mt-1 text-sm text-ink/50">本支部已发布的测验</p>
      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}

      <div className="mt-4 grid gap-3">
        {items.map((x) => (
          <div key={x.id} className="m-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-ink">{x.title}</div>
              <span
                className={
                  x.type === 'formal'
                    ? 'rounded-full bg-seal/10 px-2 py-0.5 text-[10px] font-medium text-seal'
                    : 'rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-ink/45'
                }
              >
                {x.type === 'formal' ? '正式考试' : '测验'}
              </span>
            </div>
            <div className="mt-1 text-xs text-ink/45">
              {x.durationMin} 分钟 · 及格 {x.passScore} · 剩余 {x.remainingAttempts} 次
              {x.bestScore != null ? ` · 最好 ${x.bestScore}` : ''}
            </div>
            <div className="mt-3">
              {x.canAttempt ? (
                <Link to={`/exam/${x.id}`}>
                  <Button className="w-full">开始作答</Button>
                </Link>
              ) : (
                <Button className="w-full" disabled>
                  次数已用尽
                </Button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="py-10 text-center text-sm text-ink/40">暂无可参与测验</div>}
      </div>

      <h2 className="mt-6 text-sm font-semibold text-ink">我的成绩</h2>
      <div className="mt-2 grid gap-2">
        {history.slice(0, 10).map((h) => (
          <Link key={h.id} to={`/exam-result/${h.id}`} className="m-card flex items-center justify-between p-3">
            <div>
              <div className="text-sm font-medium">{h.examTitle}</div>
              <div className="mt-0.5 text-xs text-ink/45">{new Date(h.createdAt).toLocaleString()}</div>
            </div>
            <div className={`text-sm font-bold ${h.isPass ? 'text-[#1f6b4a]' : 'text-seal'}`}>{h.totalScore} 分</div>
          </Link>
        ))}
        {history.length === 0 && <div className="py-6 text-center text-sm text-ink/40">暂无成绩</div>}
      </div>
    </div>
  )
}
