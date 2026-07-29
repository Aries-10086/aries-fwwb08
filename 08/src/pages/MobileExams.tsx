import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ArrowRight,
  ClipboardText,
  ClockCounterClockwise,
  BookBookmark,
  Sparkle,
} from '@phosphor-icons/react'

type Attempt = {
  id: string
  totalScore: number
  isPass: boolean
  createdAt: string
}

type Exam = {
  id: string
  title: string
  durationMin: number
  passScore: number
  maxAttempts: number
  attemptCount: number
  remainingAttempts: number
  canAttempt: boolean
  bestScore: number | null
  attempts: Attempt[]
  status: string
  createdAt: string
}

type HistoryItem = {
  id: string
  examId: string
  examTitle: string
  totalScore: number
  passScore: number | null
  isPass: boolean
  createdAt: string
}

export default function MobileExams() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [items, setItems] = useState<Exam[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) nav('/login')
  }, [nav, user])

  async function load() {
    setError(null)
    try {
      const [data, hist] = await Promise.all([
        apiFetch<Exam[]>('/api/exams'),
        apiFetch<HistoryItem[]>('/api/exams/attempts/mine'),
      ])
      setItems(data)
      setHistory(hist)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">党员端</div>
          <h1 className="page-title text-3xl md:text-4xl">测验列表</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/m/wrong-book">
            <Button variant="secondary">
              <BookBookmark className="h-4 w-4" />
              错题本
            </Button>
          </Link>
          <Link to="/m/report">
            <Button>
              <Sparkle className="h-4 w-4" />
              AI 报告
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardText className="h-5 w-5 text-[#9e1b2b]" />
            可参与测验
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {items.map((x) => (
              <div
                key={x.id}
                className="rounded-xl bg-white/90 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#12151c]">{x.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {x.durationMin} 分钟 · 及格 {x.passScore} 分 · 已考 {x.attemptCount}/
                      {x.maxAttempts} 次
                      {x.bestScore != null ? ` · 最高分 ${x.bestScore}` : ''}
                    </div>
                  </div>
                  {x.canAttempt ? (
                    <Link to={`/m/exam/${x.id}`}>
                      <Button className="px-3">
                        {x.attemptCount > 0 ? '再考一次' : '开始'}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-zinc-500">次数已用完</span>
                  )}
                </div>
                {(x.attempts?.length ?? 0) > 0 && (
                  <div className="mt-3 grid gap-1.5 border-t border-black/5 pt-3">
                    <div className="text-xs font-medium text-zinc-500">本测验历史 · 点击回顾</div>
                    {x.attempts.slice(0, 5).map((a) => (
                      <Link
                        key={a.id}
                        to={`/m/exam-result/${a.id}`}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-[rgba(18,21,28,0.75)] transition hover:bg-[rgba(158,27,43,0.05)]"
                      >
                        <span>{new Date(a.createdAt).toLocaleString()}</span>
                        <span className="font-medium">
                          {a.totalScore} 分 · {a.isPass ? '通过' : '未通过'}
                          <ArrowRight className="ml-1 inline h-3 w-3" />
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && <div className="py-8 text-sm text-zinc-400">暂无可参与测验</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockCounterClockwise className="h-5 w-5 text-[#9e1b2b]" />
            全部历史成绩
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {history.map((a) => (
              <Link
                key={a.id}
                to={`/m/exam-result/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition hover:bg-[rgba(158,27,43,0.05)]"
              >
                <div>
                  <div className="text-sm font-medium text-[#12151c]">{a.examTitle}</div>
                  <div className="mt-1 text-xs text-[rgba(18,21,28,0.45)]">
                    {new Date(a.createdAt).toLocaleString()}
                    {a.passScore != null ? ` · 及格 ${a.passScore}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-[#12151c]">{a.totalScore} 分</div>
                  <div className={`text-xs ${a.isPass ? 'text-[#1f6b4a]' : 'text-[#9e1b2b]'}`}>
                    {a.isPass ? '通过' : '未通过'} · 回顾错题
                  </div>
                </div>
              </Link>
            ))}
            {history.length === 0 && <div className="py-8 text-sm text-zinc-400">暂无历史成绩</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
