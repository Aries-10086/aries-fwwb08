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
          <div className="page-eyebrow">党员端</div>
          <h1 className="page-title text-3xl md:text-4xl">
            {exam?.title ?? '测验'}
          </h1>
          {exam && <div className="page-subtitle mt-2">{exam.durationMin} 分钟 · 及格 {exam.passScore} 分</div>}
        </div>
        <Link to="/m/exams">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
        </Link>
      </div>

      {error && (
        <div className="border border-[rgba(163,24,40,0.2)] bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020]">
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
            <div className="grid gap-3">
              <div className="list-surface text-sm text-[rgba(14,17,22,0.75)]">
                总分：<span className="font-semibold text-[#0e1116]">{result.totalScore}</span> / 100 ·
                结果：<span className={result.isPass ? 'text-[#a31828]' : 'text-[#7a1020]'}>{result.isPass ? '通过' : '未通过'}</span>
              </div>
              <div className="grid gap-2">
                {(result.details ?? []).map((d: any) => (
                  <div
                    key={d.questionId}
                    className="flex items-center justify-between rounded-lg bg-white px-4 py-3 text-sm border border-[rgba(14,17,22,0.1)]"
                  >
                    <div className="text-[rgba(14,17,22,0.75)]">{d.questionId}</div>
                    <div className="text-[#0e1116]">{d.score}/{d.maxScore}</div>
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
                <div key={q.id} className="list-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-[#0e1116]">
                      {idx + 1}. {q.stem}
                    </div>
                    <div className="text-xs text-[#a31828]">分值 {q.score}</div>
                  </div>
                  <div className="mt-1 text-xs text-[rgba(14,17,22,0.45)]">{q.category}</div>

                  {q.type === 'tf' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[{ label: '正确', value: true }, { label: '错误', value: false }].map((it) => (
                        <button
                          key={it.label}
                          onClick={() => setAnswers((p) => ({ ...p, [q.id]: it.value }))}
                          className={[
                            'rounded-lg px-4 py-3 text-left text-sm transition',
                            'border border-[rgba(14,17,22,0.1)]',
                            answers[q.id] === it.value ? 'bg-[#a31828] text-white' : 'bg-white text-[#0e1116] hover:bg-[rgba(163,24,40,0.04)]',
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
                            className="flex cursor-pointer items-start gap-3 rounded-lg bg-white px-4 py-3 border border-[rgba(14,17,22,0.1)] hover:bg-[rgba(163,24,40,0.04)] transition"
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
                              <div className="text-xs text-[rgba(14,17,22,0.45)]">{op.key}</div>
                              <div className="text-sm text-[rgba(14,17,22,0.75)]">{op.text}</div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}

              {qs.length === 0 && <div className="py-10 text-sm text-[rgba(14,17,22,0.4)]">暂无题目</div>}

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

