import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'

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
  status: string
  paper: { id: string; questions: Question[] } | null
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

  useEffect(() => {
    if (!user) nav('/login')
  }, [nav, user])

  async function load() {
    if (!examId) return
    setError(null)
    try {
      const data = await apiFetch<ExamDetail>(`/api/exams/${examId}`)
      setExam(data)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }

  useEffect(() => {
    load()
  }, [examId])

  const qs = useMemo(() => exam?.paper?.questions ?? [], [exam])

  async function submit() {
    if (!examId) return
    setSubmitting(true)
    setError(null)
    try {
      const data = await apiFetch<any>(`/api/exams/${examId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      })
      setResult(data)
    } catch (e: any) {
      setError(e?.message ?? '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-400">党员端</div>
          <h1 className="mt-2 text-2xl font-[850] tracking-[-0.05em] text-zinc-50">
            {exam?.title ?? '测验'}
          </h1>
          {exam && <div className="mt-2 text-sm text-zinc-300/90">{exam.durationMin} 分钟 · 及格 {exam.passScore} 分</div>}
        </div>
        <Link to="/m/exams">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-500/10 px-4 py-3 text-rose-200 shadow-[0_0_0_1px_rgba(244,63,94,0.25)]">
          {error}
        </div>
      )}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-amber-200/90" />
              已交卷
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="rounded-lg bg-white/5 px-4 py-3 text-sm text-zinc-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
                总分：<span className="font-semibold text-zinc-50">{result.totalScore}</span> / 100 ·
                结果：<span className={result.isPass ? 'text-amber-200' : 'text-rose-200'}>{result.isPass ? '通过' : '未通过'}</span>
              </div>
              <div className="grid gap-2">
                {(result.details ?? []).map((d: any) => (
                  <div
                    key={d.questionId}
                    className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                  >
                    <div className="text-zinc-200">{d.questionId}</div>
                    <div className="text-zinc-100">{d.score}/{d.maxScore}</div>
                  </div>
                ))}
              </div>
              <Link to="/m/report">
                <Button className="w-full">生成 AI 综合评价报告</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>作答</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              {qs.map((q, idx) => (
                <div key={q.id} className="rounded-xl bg-white/5 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-100">
                      {idx + 1}. {q.stem}
                    </div>
                    <div className="text-xs text-amber-200/90">分值 {q.score}</div>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{q.category}</div>

                  {q.type === 'tf' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[{ label: '正确', value: true }, { label: '错误', value: false }].map((it) => (
                        <button
                          key={it.label}
                          onClick={() => setAnswers((p) => ({ ...p, [q.id]: it.value }))}
                          className={[
                            'rounded-lg px-4 py-3 text-left text-sm transition',
                            'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]',
                            answers[q.id] === it.value ? 'bg-amber-300/90 text-zinc-950' : 'bg-black/30 text-zinc-200 hover:bg-white/10',
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
                            className="flex cursor-pointer items-start gap-3 rounded-lg bg-black/30 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] hover:bg-white/10 transition"
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
                                const next = prev.includes(op.key) ? prev.filter((x) => x !== op.key) : [...prev, op.key]
                                setAnswers((p) => ({ ...p, [q.id]: next }))
                              }}
                              className="mt-1 accent-amber-300"
                            />
                            <div>
                              <div className="text-xs text-zinc-500">{op.key}</div>
                              <div className="text-sm text-zinc-200">{op.text}</div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}

              {qs.length === 0 && <div className="py-10 text-sm text-zinc-400">暂无题目</div>}

              <Button onClick={() => submit()} disabled={submitting || qs.length === 0} className="w-full">
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
      )}
    </div>
  )
}

