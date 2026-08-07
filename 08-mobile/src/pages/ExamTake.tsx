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
  type?: 'quiz' | 'formal'
  openNotice?: string
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
  const [phase, setPhase] = useState<'loading' | 'notice' | 'taking'>('loading')
  const [noticeOk, setNoticeOk] = useState(false)
  const [starting, setStarting] = useState(false)
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

  async function beginSession() {
    if (!examId || starting) return
    setStarting(true)
    setError(null)
    try {
      const session = await apiFetch<{ sessionId: string; expiresAt: string }>(`/api/exams/${examId}/start`, {
        method: 'POST',
        body: '{}',
      })
      setSessionId(session.sessionId)
      setRemainMs(Math.max(0, new Date(session.expiresAt).getTime() - Date.now()))
      setPhase('taking')
    } catch (e: any) {
      setError(e?.message ?? '开考失败')
    } finally {
      setStarting(false)
    }
  }

  useEffect(() => {
    if (!examId) return
    void (async () => {
      setPhase('loading')
      setNoticeOk(false)
      try {
        const data = await apiFetch<ExamDetail>(`/api/exams/${examId}`)
        setExam(data)
        if (!data.canAttempt) {
          setError('已达最大作答次数')
          return
        }
        if (data.type === 'formal' || Boolean(data.openNotice?.trim())) {
          setPhase('notice')
          return
        }
        await beginSession()
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
        {remainMs != null && phase === 'taking' && (
          <div className="rounded-full bg-seal/10 px-3 py-1 text-xs font-semibold text-seal">
            {formatRemain(remainMs)}
          </div>
        )}
      </div>
      <h1 className="mt-3 text-xl font-bold">{exam?.title ?? '测验'}</h1>
      {exam?.type === 'formal' && <div className="mt-1 text-xs font-medium text-seal">正式考试</div>}
      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}

      {phase === 'notice' && exam && (
        <div className="m-card mt-4 p-4">
          <div className="text-sm font-semibold">开考说明</div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink/75">
            {exam.openNotice?.trim() ||
              '正式考试须独立完成，开考后不可中途离开；到时将强制交卷。请确认已阅读说明。'}
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 accent-[var(--seal)]"
              checked={noticeOk}
              onChange={(e) => setNoticeOk(e.target.checked)}
            />
            <span>我已阅读并同意，确认开考</span>
          </label>
          <Button className="mt-4 w-full" disabled={!noticeOk || starting} onClick={() => void beginSession()}>
            {starting ? '开考中…' : '确认开考'}
          </Button>
        </div>
      )}

      {phase === 'taking' && (
        <>
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
                        onClick={() => setAnswers((p) => ({ ...p, [q.id]: it.value }))}
                        className={`rounded-xl px-3 py-3 text-sm ${
                          answers[q.id] === it.value ? 'bg-seal text-white' : 'bg-paper text-ink'
                        }`}
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
                        <label
                          key={op.key}
                          className={`flex items-start gap-2 rounded-xl px-3 py-3 text-sm ${
                            checked ? 'bg-seal/10' : 'bg-paper'
                          }`}
                        >
                          <input
                            type={q.type === 'single' ? 'radio' : 'checkbox'}
                            className="mt-0.5 accent-[var(--seal)]"
                            checked={!!checked}
                            onChange={() => {
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
                          />
                          <span>
                            {op.key}. {op.text}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button className="mt-6 w-full" disabled={submitting || !sessionId} onClick={() => void submit(false)}>
            {submitting ? '交卷中…' : '交卷'}
          </Button>
        </>
      )}
    </div>
  )
}
