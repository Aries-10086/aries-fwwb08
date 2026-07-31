import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { ArrowLeft } from '@phosphor-icons/react'

type Question = {
  id: string
  type: 'single' | 'multiple' | 'tf'
  stem: string
  options?: { key: string; text: string }[] | null
  score: number
}

type ExamDetail = {
  id: string
  title: string
  durationMin: number
  passScore: number
  canAttempt: boolean
  paper: { questions: Question[] } | null
}

function formatRemain(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function ExamTake() {
  const { examId } = useParams()
  const nav = useNavigate()
  const [exam, setExam] = useState<ExamDetail | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [remainMs, setRemainMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const autoSubmitted = useRef(false)

  async function submit(force = false) {
    if (!examId || !sessionId || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const data = await apiFetch<{ attemptId: string }>(`/api/exams/${examId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ sessionId, answers, forceTimeout: force }),
      })
      nav(`/exam-result/${data.attemptId}`, { replace: true })
    } catch (e: any) {
      setError(e?.message ?? '交卷失败')
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!examId) return
    void (async () => {
      try {
        const data = await apiFetch<ExamDetail>(`/api/exams/${examId}`)
        setExam(data)
        if (!data.canAttempt) {
          setError('已达最大作答次数')
          return
        }
        const session = await apiFetch<{ sessionId: string; expiresAt: string }>(`/api/exams/${examId}/start`, {
          method: 'POST',
          body: '{}',
        })
        setSessionId(session.sessionId)
        setRemainMs(Math.max(0, new Date(session.expiresAt).getTime() - Date.now()))
      } catch (e: any) {
        setError(e?.message ?? '加载失败')
      }
    })()
  }, [examId])

  useEffect(() => {
    if (remainMs == null) return
    const t = window.setInterval(() => {
      setRemainMs((prev) => {
        if (prev == null) return prev
        const next = Math.max(0, prev - 1000)
        if (next <= 0 && !autoSubmitted.current) {
          autoSubmitted.current = true
          void submit(true)
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [remainMs == null, sessionId])

  const questions = exam?.paper?.questions ?? []

  return (
    <div className="px-4 pb-8 pt-[max(0.75rem,var(--safe-top))]">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="inline-flex items-center gap-1 text-sm text-ink/55" onClick={() => nav('/exams')}>
          <ArrowLeft size={16} /> 退出
        </button>
        {remainMs != null && (
          <div className="rounded-full bg-seal/10 px-3 py-1 text-xs font-semibold text-seal">
            {formatRemain(remainMs)}
          </div>
        )}
      </div>
      <h1 className="mt-3 text-xl font-bold">{exam?.title ?? '测验'}</h1>
      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}

      <div className="mt-4 grid gap-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="m-card p-4">
            <div className="text-sm font-medium">
              {idx + 1}. {q.stem}
            </div>
            {q.type === 'tf' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { label: '正确', value: true },
                  { label: '错误', value: false },
                ].map((it) => (
                  <button
                    key={it.label}
                    type="button"
                    className={`rounded-xl px-3 py-3 text-sm ${
                      answers[q.id] === it.value ? 'bg-seal text-white' : 'bg-paper text-ink'
                    }`}
                    onClick={() => setAnswers((p) => ({ ...p, [q.id]: it.value }))}
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
                  const checked =
                    q.type === 'single'
                      ? selected === op.key
                      : Array.isArray(selected) && selected.includes(op.key)
                  return (
                    <button
                      key={op.key}
                      type="button"
                      className={`rounded-xl px-3 py-3 text-left text-sm ${
                        checked ? 'bg-seal/10 text-seal' : 'bg-paper text-ink'
                      }`}
                      onClick={() => {
                        if (q.type === 'single') {
                          setAnswers((p) => ({ ...p, [q.id]: op.key }))
                          return
                        }
                        const prev = Array.isArray(selected) ? (selected as string[]) : []
                        const next = prev.includes(op.key)
                          ? prev.filter((x) => x !== op.key)
                          : [...prev, op.key]
                        setAnswers((p) => ({ ...p, [q.id]: next }))
                      }}
                    >
                      <span className="text-xs text-ink/40">{op.key}. </span>
                      {op.text}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {sessionId && (
        <Button className="mt-5 w-full" disabled={submitting} onClick={() => void submit(false)}>
          {submitting ? '交卷中…' : '提交答卷'}
        </Button>
      )}
    </div>
  )
}
