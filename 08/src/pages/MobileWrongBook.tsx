import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { QuestionExplainPanel } from '@/components/QuestionExplainPanel'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ArrowLeft,
  BookBookmark,
  CheckCircle,
  CircleNotch,
  ListChecks,
  XCircle,
} from '@phosphor-icons/react'

type WrongBookItem = {
  questionId: string
  type: string
  category: string
  stem: string
  options?: { key: string; text: string }[] | null
  wrongCount: number
  lastWrongAt: string
  lastExamTitle: string
  lastAttemptId: string
  lastUserAnswerLabel: string
  correctAnswerLabel: string
  reviewStatus: 'pending' | 'mastered'
  reviewCorrectCount: number
}

type WrongBookData = {
  totalCount: number
  pendingCount: number
  masteredCount: number
  categories: { name: string; count: number }[]
  items: WrongBookItem[]
}

type PracticeQuestion = {
  questionId: string
  type: string
  category: string
  stem: string
  options?: { key: string; text: string }[] | null
}

type PracticeDetail = {
  questionId: string
  type: string
  category: string
  stem: string
  userAnswerLabel: string
  correctAnswerLabel: string
  isCorrect: boolean
}

type PracticeResult = {
  totalCount: number
  correctCount: number
  wrongCount: number
  details: PracticeDetail[]
  progressUpdates?: Array<{
    questionId: string
    reviewStatus: 'pending' | 'mastered'
    removed: boolean
    toMastered: boolean
    backToPending: boolean
  }>
}

function QuestionInputs({
  questions,
  answers,
  setAnswers,
}: {
  questions: PracticeQuestion[]
  answers: Record<string, unknown>
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
}) {
  return (
    <div className="grid gap-6">
      {questions.map((q, idx) => (
        <div key={q.questionId} className="rounded-xl bg-white/90 p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
          <div className="text-sm font-medium text-[#12151c]">
            {idx + 1}. {q.stem}
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
                  type="button"
                  onClick={() => setAnswers((p) => ({ ...p, [q.questionId]: it.value }))}
                  className={[
                    'rounded-lg px-4 py-3 text-left text-sm transition',
                    'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
                    answers[q.questionId] === it.value
                      ? 'bg-[#9e1b2b] text-white'
                      : 'bg-white/90 text-[#12151c] hover:bg-[rgba(158,27,43,0.05)]',
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
                const selected = answers[q.questionId]
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
                      isChecked ? 'bg-[rgba(158,27,43,0.08)]' : 'bg-white/90 hover:bg-[rgba(158,27,43,0.05)]',
                    ].join(' ')}
                  >
                    <input
                      type={q.type === 'single' ? 'radio' : 'checkbox'}
                      name={q.questionId}
                      checked={isChecked}
                      onChange={() => {
                        if (q.type === 'single') {
                          setAnswers((p) => ({ ...p, [q.questionId]: op.key }))
                          return
                        }
                        const prev = Array.isArray(selected) ? selected : []
                        const next = prev.includes(op.key)
                          ? prev.filter((x) => x !== op.key)
                          : [...prev, op.key]
                        setAnswers((p) => ({ ...p, [q.questionId]: next }))
                      }}
                      className="mt-1 accent-[#9e1b2b]"
                    />
                    <div>
                      <div className="text-xs text-zinc-500">{op.key}</div>
                      <div className="text-sm text-[#12151c]">{op.text}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function MobileWrongBook() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [book, setBook] = useState<WrongBookData | null>(null)
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'mastered'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'practice' | 'result'>('list')
  const [practiceQs, setPracticeQs] = useState<PracticeQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) nav('/login')
  }, [nav, user])

  async function loadBook() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<WrongBookData>('/api/exams/wrong-book/mine')
      setBook(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载错题本失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) void loadBook()
  }, [user])

  const filteredItems = useMemo(() => {
    if (!book) return []
    if (statusTab === 'pending') return book.items.filter((it) => it.reviewStatus === 'pending')
    if (statusTab === 'mastered') return book.items.filter((it) => it.reviewStatus === 'mastered')
    return book.items
  }, [book, statusTab])

  const progressSummary = useMemo(() => {
    if (!result?.progressUpdates?.length) return null
    return {
      toMastered: result.progressUpdates.filter((u) => u.toMastered).length,
      removed: result.progressUpdates.filter((u) => u.removed).length,
      backToPending: result.progressUpdates.filter((u) => u.backToPending).length,
    }
  }, [result])

  async function startPractice(questionIds?: string[]) {
    setError(null)
    setSubmitting(true)
    try {
      const qs = questionIds?.length
        ? `?ids=${encodeURIComponent(questionIds.join(','))}`
        : ''
      const data = await apiFetch<{ questions: PracticeQuestion[] }>(`/api/exams/wrong-book/practice${qs}`)
      if (!data.questions.length) {
        setError('暂无错题可重练')
        return
      }
      setPracticeQs(data.questions)
      setAnswers({})
      setResult(null)
      setView('practice')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载重练题目失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitPractice() {
    setSubmitting(true)
    setError(null)
    try {
      const data = await apiFetch<PracticeResult>('/api/exams/wrong-book/practice', {
        method: 'POST',
        body: JSON.stringify({ answers }),
      })
      setResult(data)
      setView('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  function backToList() {
    setView('list')
    setPracticeQs([])
    setAnswers({})
    setResult(null)
    void loadBook()
  }

  if (view === 'practice') {
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="page-eyebrow">错题本</div>
            <h1 className="page-title text-3xl md:text-4xl">错题重练</h1>
            <div className="page-subtitle mt-2">共 {practiceQs.length} 题 · 不计入正式成绩</div>
          </div>
          <Button variant="secondary" onClick={backToList}>
            <ArrowLeft className="h-4 w-4" />
            返回错题本
          </Button>
        </div>

        {error && (
          <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
            {error}
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <QuestionInputs questions={practiceQs} answers={answers} setAnswers={setAnswers} />
            <Button
              onClick={() => void submitPractice()}
              disabled={submitting || practiceQs.length === 0}
              className="mt-6 w-full md:w-auto"
            >
              {submitting ? (
                <>
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  判分中…
                </>
              ) : (
                '提交自测'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (view === 'result' && result) {
    const wrongIds = result.details.filter((d) => !d.isCorrect).map((d) => d.questionId)
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="page-eyebrow">错题本</div>
            <h1 className="page-title text-3xl md:text-4xl">重练结果</h1>
            <div className="page-subtitle mt-2">
              正确 {result.correctCount} / 共 {result.totalCount} 题
            </div>
          </div>
          <Button variant="secondary" onClick={backToList}>
            <ArrowLeft className="h-4 w-4" />
            返回错题本
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['总题数', result.totalCount],
            ['答对', result.correctCount],
            ['仍错', result.wrongCount],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(18,21,28,0.4)]">{k}</div>
              <div className="mt-1 text-xl font-bold text-[#12151c]">{v}</div>
            </div>
          ))}
        </div>

        {progressSummary && (progressSummary.toMastered > 0 || progressSummary.removed > 0 || progressSummary.backToPending > 0) && (
          <div className="rounded-xl bg-[rgba(31,107,74,0.06)] px-4 py-3 text-sm text-[#1f6b4a] shadow-[inset_0_0_0_1px_rgba(31,107,74,0.12)]">
            {progressSummary.toMastered > 0 && <div>{progressSummary.toMastered} 题已进入「已掌握」</div>}
            {progressSummary.removed > 0 && <div>{progressSummary.removed} 题已移出错题本</div>}
            {progressSummary.backToPending > 0 && <div>{progressSummary.backToPending} 题已回到「待复习」</div>}
          </div>
        )}

        <div className="grid gap-3">
          {result.details.map((d, idx) => (
            <div
              key={d.questionId}
              className={[
                'rounded-xl p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
                d.isCorrect ? 'bg-[rgba(31,107,74,0.06)]' : 'bg-[rgba(158,27,43,0.05)]',
              ].join(' ')}
            >
              <div className="flex items-start gap-2">
                {d.isCorrect ? (
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#1f6b4a]" weight="fill" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#9e1b2b]" weight="fill" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[#12151c]">
                    {idx + 1}. {d.stem}
                  </div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div>
                      <span className="text-zinc-500">你的答案：</span>
                      <span className={d.isCorrect ? 'text-[#1f6b4a]' : 'text-[#9e1b2b]'}>{d.userAnswerLabel}</span>
                    </div>
                    {!d.isCorrect && (
                      <div>
                        <span className="text-zinc-500">正确答案：</span>
                        <span className="font-medium text-[#12151c]">{d.correctAnswerLabel}</span>
                      </div>
                    )}
                  </div>
                  {!d.isCorrect && (
                    <QuestionExplainPanel questionId={d.questionId} compact />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {wrongIds.length > 0 && (
            <Button onClick={() => void startPractice(wrongIds)} disabled={submitting}>
              再练错题（{wrongIds.length}）
            </Button>
          )}
          <Button variant="secondary" onClick={() => void startPractice(practiceQs.map((q) => q.questionId))}>
            全部再练一遍
          </Button>
          <Button variant="secondary" onClick={backToList}>
            返回错题本
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">党员端</div>
          <h1 className="page-title text-3xl md:text-4xl">错题本</h1>
          <div className="page-subtitle mt-2 max-w-2xl">
            汇总历次测验错题；重练答对 1 次进「已掌握」，再对 1 次移出；已掌握时再错则回到「待复习」
          </div>
        </div>
        {book && book.totalCount > 0 && (
          <Button onClick={() => void startPractice()} disabled={submitting || loading}>
            <ListChecks className="h-4 w-4" />
            开始重练
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
          <CircleNotch className="h-5 w-5 animate-spin" />
          加载中…
        </div>
      ) : !book || book.totalCount === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookBookmark className="mx-auto h-12 w-12 text-zinc-300" />
            <p className="mt-4 text-sm text-zinc-500">暂无错题记录</p>
            <p className="mt-1 text-xs text-zinc-400">完成测验后，答错的题目会自动收录到这里</p>
            <Link to="/m/exams" className="mt-4 inline-block">
              <Button variant="secondary">去测验</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', '全部', book.totalCount],
                ['pending', '待复习', book.pendingCount ?? 0],
                ['mastered', '已掌握', book.masteredCount ?? 0],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusTab(key)}
                className={[
                  'rounded-full px-3 py-1.5 text-xs transition',
                  statusTab === key
                    ? 'bg-[#9e1b2b] text-white'
                    : 'bg-white/90 text-zinc-600 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
                ].join(' ')}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                错题列表
                <span className="ml-2 text-sm font-normal text-zinc-500">({filteredItems.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {filteredItems.map((item) => {
                const open = expandedId === item.questionId
                return (
                  <div
                    key={item.questionId}
                    className="rounded-xl bg-white/90 p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setExpandedId(open ? null : item.questionId)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[#12151c]">{item.stem}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                            <span>{item.category || '未分类'}</span>
                            <span>·</span>
                            <span>错 {item.wrongCount} 次</span>
                            <span>·</span>
                            <span>{item.lastExamTitle}</span>
                            <span>·</span>
                            <span className={item.reviewStatus === 'mastered' ? 'text-[#1f6b4a]' : 'text-[#9e1b2b]'}>
                              {item.reviewStatus === 'mastered' ? '已掌握' : '待复习'}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-[#9e1b2b]">{open ? '收起' : '详情'}</span>
                      </div>
                    </button>

                    {open && (
                      <div className="mt-3 space-y-2 border-t border-black/5 pt-3 text-xs">
                        <div>
                          <span className="text-zinc-500">上次作答：</span>
                          <span className="text-[#9e1b2b]">{item.lastUserAnswerLabel}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">正确答案：</span>
                          <span className="font-medium text-[#12151c]">{item.correctAnswerLabel}</span>
                        </div>
                        <div className="text-zinc-400">
                          {new Date(item.lastWrongAt).toLocaleString()} ·{' '}
                          <Link to={`/m/exam-result/${item.lastAttemptId}`} className="text-[#9e1b2b] hover:underline">
                            查看原测验
                          </Link>
                        </div>
                        <Button
                          className="mt-2"
                          variant="secondary"
                          onClick={() => void startPractice([item.questionId])}
                          disabled={submitting}
                        >
                          单题重练
                        </Button>
                        <QuestionExplainPanel
                          questionId={item.questionId}
                          attemptId={item.lastAttemptId}
                          compact
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
