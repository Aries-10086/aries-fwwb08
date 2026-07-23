import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ArrowLeft, CheckCircle2, CircleX, Loader2, Timer } from 'lucide-react'

type QuestionType = 'single' | 'multiple' | 'tf'

type Question = {
  id: string
  type: QuestionType
  category: string
  stem: string
  options?: { key: string; text: string }[] | null
  score: number
  orderNo: number
}

type ExamDetail = {
  id: string
  title: string
  durationMin: number
  passScore: number
  maxAttempts: number
  attemptCount: number
  remainingAttempts: number
  canAttempt: boolean
  status: string
  paper: { id: string; questions: Question[] } | null
}

function formatRemain(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export default function MobileExamTake() {
  const nav = useNavigate()
  const { examId } = useParams()
  const { user } = useAuthStore()
  const [exam, setExam] = useState<ExamDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [remainMs, setRemainMs] = useState<number | null>(null)
  const autoSubmitted = useRef(false)

  useEffect(() => {
    if (!user) nav('/login')
  }, [nav, user])

  async function load() {
    if (!examId) return
    setError(null)
    setResult(null)
    setAnswers({})
    setSessionId(null)
    setRemainMs(null)
    autoSubmitted.current = false
    try {
      const data = await apiFetch<ExamDetail>(`/api/exams/${examId}`)
      setExam(data)
      if (!data.canAttempt) {
        setError(`已达最大作答次数（${data.maxAttempts} 次）`)
        return
      }
      const session = await apiFetch<{
        sessionId: string
        startedAt: string
        expiresAt: string
        durationMin: number
      }>(`/api/exams/${examId}/start`, { method: 'POST', body: '{}' })
      setSessionId(session.sessionId)
      setRemainMs(Math.max(0, new Date(session.expiresAt).getTime() - Date.now()))
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }

  useEffect(() => {
    load()
  }, [examId])

  useEffect(() => {
    if (remainMs == null || result) return
    const t = window.setInterval(() => {
      setRemainMs((prev) => {
        if (prev == null) return prev
        return Math.max(0, prev - 1000)
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [remainMs != null, !!result])

  const qs = useMemo(() => exam?.paper?.questions ?? [], [exam])

  async function submit(auto = false) {
    if (!examId || !sessionId || submitting || result) return
    setSubmitting(true)
    setError(null)
    try {
      const data = await apiFetch<any>(`/api/exams/${examId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers, sessionId }),
      })
      setResult(data)
      if (auto) setError('考试时间到，已自动交卷')
    } catch (e: any) {
      setError(e?.message ?? '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (remainMs !== 0 || autoSubmitted.current || result || !sessionId) return
    autoSubmitted.current = true
    void submit(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainMs, sessionId, result])

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">党员端</div>
          <h1 className="page-title text-3xl md:text-4xl">{exam?.title ?? '测验'}</h1>
          {exam && (
            <div className="page-subtitle mt-2 max-w-2xl">
              {exam.durationMin} 分钟 · 及格 {exam.passScore} 分 · 剩余次数{' '}
              {exam.remainingAttempts}/{exam.maxAttempts}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {remainMs != null && !result && (
            <div
              className={[
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
                remainMs <= 60_000 ? 'bg-[rgba(163,24,40,0.08)] text-[#7a1020]' : 'bg-white/90 text-[#0e1116]',
              ].join(' ')}
            >
              <Timer className="h-4 w-4" />
              {formatRemain(remainMs)}
            </div>
          )}
          <Link to="/m/exams">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020] shadow-[inset_0_0_0_1px_rgba(163,24,40,0.16)]">
          {error}
        </div>
      )}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#a31828]" />
              已交卷
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="rounded-lg bg-white/90 px-4 py-3 text-sm text-[rgba(14,17,22,0.7)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                总分：<span className="font-semibold text-[#0e1116]">{result.totalScore}</span> · 结果：
                <span className={result.isPass ? 'text-[#1f6b4a]' : 'text-[#7a1020]'}>
                  {result.isPass ? '通过' : '未通过'}
                </span>
                <span className="ml-2 text-zinc-500">
                  对 {result.correctCount ?? 0} · 错 {result.wrongCount ?? 0}
                </span>
                {typeof result.remainingAttempts === 'number' && (
                  <span className="ml-2 text-zinc-500">剩余次数 {result.remainingAttempts}</span>
                )}
              </div>

              {(result.wrongDetails?.length ?? 0) > 0 && (
                <div className="grid gap-2">
                  <div className="text-sm font-medium text-[#0e1116]">错题回顾</div>
                  {result.wrongDetails.map((d: any) => (
                    <div
                      key={d.questionId}
                      className="rounded-xl bg-[rgba(163,24,40,0.05)] p-4 shadow-[inset_0_0_0_1px_rgba(163,24,40,0.12)]"
                    >
                      <div className="flex items-start gap-2">
                        <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-[#a31828]" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[#0e1116]">{d.stem}</div>
                          <div className="mt-2 grid gap-1 text-xs md:grid-cols-2">
                            <div>
                              <span className="text-[rgba(14,17,22,0.45)]">你的答案：</span>
                              <span className="text-[#a31828]">{d.userAnswerLabel}</span>
                            </div>
                            <div>
                              <span className="text-[rgba(14,17,22,0.45)]">正确答案：</span>
                              <span className="text-[#0e1116]">{d.correctAnswerLabel}</span>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-zinc-500">
                          {d.score}/{d.maxScore}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(result.wrongDetails?.length ?? 0) === 0 && (
                <div className="rounded-xl bg-[rgba(31,107,74,0.06)] px-4 py-3 text-sm text-[#1f6b4a]">
                  全部答对，继续保持！
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {result.attemptId && (
                  <Link to={`/m/exam-result/${result.attemptId}`}>
                    <Button>查看完整回顾</Button>
                  </Link>
                )}
                <Link to="/m/report">
                  <Button variant="secondary">生成 AI 综合评价报告</Button>
                </Link>
                {result.remainingAttempts > 0 && (
                  <Button variant="secondary" onClick={() => load()}>
                    再次作答
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : exam?.canAttempt && sessionId ? (
        <Card>
          <CardHeader>
            <CardTitle>作答</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              {qs.map((q, idx) => (
                <div key={q.id} className="rounded-xl bg-white/90 p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-[#0e1116]">
                      {idx + 1}. {q.stem}
                    </div>
                    <div className="text-xs text-[#a31828]">分值 {q.score}</div>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{q.category}</div>

                  {q.type === 'tf' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[
                        { label: '正确', value: true },
                        { label: '错误', value: false },
                      ].map((it) => (
                        <button
                          key={it.label}
                          onClick={() => setAnswers((p) => ({ ...p, [q.id]: it.value }))}
                          className={[
                            'rounded-lg px-4 py-3 text-left text-sm transition',
                            'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
                            answers[q.id] === it.value
                              ? 'bg-[#a31828] text-white'
                              : 'bg-white/90 text-[#0e1116] hover:bg-[rgba(163,24,40,0.05)]',
                          ].join(' ')}
                        >
                          {it.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {(q.type === 'single' || q.type === 'multiple') && (
                    <div className="mt-3 grid gap-2">
                      {(q.options ?? []).map((op) => {
                        const selected = answers[q.id]
                        const isChecked =
                          q.type === 'single'
                            ? selected === op.key
                            : Array.isArray(selected)
                              ? selected.includes(op.key)
                              : false
                        return (
                          <label
                            key={op.key}
                            className={[
                              'flex cursor-pointer items-start gap-3 rounded-lg px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition',
                              isChecked ? 'bg-[rgba(163,24,40,0.08)]' : 'bg-white/90 hover:bg-[rgba(163,24,40,0.05)]',
                            ].join(' ')}
                          >
                            <input
                              type={q.type === 'single' ? 'radio' : 'checkbox'}
                              name={q.id}
                              checked={isChecked}
                              onChange={() => {
                                if (q.type === 'single') {
                                  setAnswers((p) => ({ ...p, [q.id]: op.key }))
                                  return
                                }
                                const prev = Array.isArray(selected) ? selected : []
                                const next = prev.includes(op.key)
                                  ? prev.filter((x) => x !== op.key)
                                  : [...prev, op.key]
                                setAnswers((p) => ({ ...p, [q.id]: next }))
                              }}
                              className="mt-1 accent-[#a31828]"
                            />
                            <div>
                              <div className="text-xs text-zinc-500">{op.key}</div>
                              <div className="text-sm text-[#0e1116]">{op.text}</div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}

              {qs.length === 0 && <div className="py-10 text-sm text-zinc-400">暂无题目</div>}

              <Button onClick={() => submit(false)} disabled={submitting || qs.length === 0} className="w-full">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    提交中…
                  </>
                ) : (
                  '交卷并判分'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
