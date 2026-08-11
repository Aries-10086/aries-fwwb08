import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { ExplainButton } from '@/components/ExplainButton'
import { apiFetch } from '@/utils/api'

type Item = {
  questionId: string
  stem: string
  category: string
  wrongCount: number
  lastExamTitle: string
  lastUserAnswerLabel: string
  correctAnswerLabel: string
  lastAttemptId?: string
  reviewStatus: 'pending' | 'mastered'
}

type Book = {
  totalCount: number
  pendingCount: number
  masteredCount: number
  items: Item[]
}

type PracticeQuestion = {
  questionId: string
  type: 'single' | 'multiple' | 'tf'
  stem: string
  options?: { key: string; text: string }[] | null
  score: number
}

type PracticeResult = {
  totalScore: number
  correctCount: number
  wrongCount: number
  progressUpdates?: Array<{
    toMastered: boolean
    removed: boolean
    backToPending: boolean
  }>
}

export default function WrongBook() {
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'mastered'>('all')
  const [view, setView] = useState<'list' | 'practice' | 'result'>('list')
  const [practiceQs, setPracticeQs] = useState<PracticeQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<PracticeResult | null>(null)

  async function loadBook() {
    try {
      setBook(await apiFetch<Book>('/api/exams/wrong-book/mine'))
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }

  useEffect(() => {
    void loadBook()
  }, [])

  const filteredItems = useMemo(() => {
    if (!book) return []
    if (statusTab === 'pending') return book.items.filter((it) => it.reviewStatus === 'pending')
    if (statusTab === 'mastered') return book.items.filter((it) => it.reviewStatus === 'mastered')
    return book.items
  }, [book, statusTab])

  async function startPractice(ids?: string[]) {
    setError(null)
    try {
      const qs = ids?.length ? `?ids=${ids.join(',')}` : ''
      const data = await apiFetch<{ questions: PracticeQuestion[] }>(`/api/exams/wrong-book/practice${qs}`)
      if (!data.questions?.length) {
        setError('暂无错题可重练')
        return
      }
      setPracticeQs(data.questions)
      setAnswers({})
      setResult(null)
      setView('practice')
    } catch (e: any) {
      setError(e?.message ?? '加载重练失败')
    }
  }

  async function submitPractice() {
    setSubmitting(true)
    setError(null)
    try {
      const data = await apiFetch<PracticeResult>('/api/exams/wrong-book/practice', {
        method: 'POST',
        body: JSON.stringify({
          answers: Object.fromEntries(practiceQs.map((q) => [q.questionId, answers[q.questionId]])),
        }),
      })
      setResult(data)
      setView('result')
    } catch (e: any) {
      setError(e?.message ?? '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  function backToList() {
    setView('list')
    setResult(null)
    void loadBook()
  }

  const progressSummary = useMemo(() => {
    if (!result?.progressUpdates?.length) return null
    return {
      toMastered: result.progressUpdates.filter((u) => u.toMastered).length,
      removed: result.progressUpdates.filter((u) => u.removed).length,
      backToPending: result.progressUpdates.filter((u) => u.backToPending).length,
    }
  }, [result])

  if (view === 'practice') {
    return (
      <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
        <h1 className="pt-2 text-2xl font-bold">错题重练</h1>
        <p className="mt-1 text-sm text-ink/50">共 {practiceQs.length} 题 · 不计正式成绩</p>
        {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}
        <div className="mt-4 grid gap-3">
          {practiceQs.map((q, idx) => (
            <div key={q.questionId} className="m-card p-4">
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
                      className={`rounded-xl py-3 text-sm ${
                        answers[q.questionId] === it.value ? 'bg-seal text-white' : 'bg-paper'
                      }`}
                      onClick={() => setAnswers((p) => ({ ...p, [q.questionId]: it.value }))}
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
                    const checked =
                      q.type === 'single'
                        ? selected === op.key
                        : Array.isArray(selected) && selected.includes(op.key)
                    return (
                      <label key={op.key} className={`flex gap-2 rounded-xl px-3 py-2 text-sm ${checked ? 'bg-seal/10' : 'bg-paper'}`}>
                        <input
                          type={q.type === 'single' ? 'radio' : 'checkbox'}
                          className="mt-0.5 accent-[var(--seal)]"
                          checked={!!checked}
                          onChange={() => {
                            if (q.type === 'single') {
                              setAnswers((p) => ({ ...p, [q.questionId]: op.key }))
                              return
                            }
                            const prev = Array.isArray(selected) ? (selected as string[]) : []
                            const next = prev.includes(op.key)
                              ? prev.filter((x) => x !== op.key)
                              : [...prev, op.key]
                            setAnswers((p) => ({ ...p, [q.questionId]: next }))
                          }}
                        />
                        {op.key}. {op.text}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2">
          <Button disabled={submitting} onClick={() => void submitPractice()}>
            {submitting ? '提交中…' : '提交自测'}
          </Button>
          <Button variant="secondary" onClick={() => setView('list')}>
            返回错题本
          </Button>
        </div>
      </div>
    )
  }

  if (view === 'result' && result) {
    return (
      <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
        <h1 className="pt-2 text-2xl font-bold">重练结果</h1>
        <div className="m-card mt-4 p-5 text-center">
          <div className="text-3xl font-black text-seal">{result.correctCount}</div>
          <div className="mt-2 text-sm text-ink/55">
            对 {result.correctCount} · 错 {result.wrongCount} / 共 {result.correctCount + result.wrongCount} 题
          </div>
        </div>
        {progressSummary && (progressSummary.toMastered > 0 || progressSummary.removed > 0 || progressSummary.backToPending > 0) && (
          <div className="mt-3 rounded-xl bg-[rgba(31,107,74,0.08)] px-3 py-2 text-sm text-[#1f6b4a]">
            {progressSummary.toMastered > 0 && <div>{progressSummary.toMastered} 题已进入「已掌握」</div>}
            {progressSummary.removed > 0 && <div>{progressSummary.removed} 题已移出错题本</div>}
            {progressSummary.backToPending > 0 && <div>{progressSummary.backToPending} 题已回到「待复习」</div>}
          </div>
        )}
        <div className="mt-4 grid gap-2">
          <Button onClick={() => void startPractice(practiceQs.map((q) => q.questionId))}>再练一次</Button>
          <Button variant="secondary" onClick={backToList}>
            返回错题本
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
      <div className="flex items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl font-bold">错题本</h1>
          <p className="mt-1 text-sm text-ink/50">共 {book?.totalCount ?? 0} 题</p>
        </div>
        {(book?.totalCount ?? 0) > 0 && (
          <Button className="!min-h-9 px-3 text-xs" onClick={() => void startPractice()}>
            开始重练
          </Button>
        )}
      </div>
      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ['all', '全部', book?.totalCount ?? 0],
            ['pending', '待复习', book?.pendingCount ?? 0],
            ['mastered', '已掌握', book?.masteredCount ?? 0],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs ${
              statusTab === key ? 'bg-seal text-white' : 'bg-paper text-ink/60'
            }`}
            onClick={() => setStatusTab(key)}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        {filteredItems.map((it) => (
          <div key={it.questionId} className="m-card p-4">
            <div className="text-sm font-medium leading-snug">{it.stem}</div>
            <div className="mt-1 text-xs text-ink/45">
              {it.category || '未分类'} · 错 {it.wrongCount} 次 ·{' '}
              <span className={it.reviewStatus === 'mastered' ? 'text-[#1f6b4a]' : 'text-seal'}>
                {it.reviewStatus === 'mastered' ? '已掌握' : '待复习'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                className="!min-h-9 text-xs"
                onClick={() => setExpanded(expanded === it.questionId ? null : it.questionId)}
              >
                {expanded === it.questionId ? '收起' : '查看解析'}
              </Button>
              <Button className="!min-h-9 text-xs" onClick={() => void startPractice([it.questionId])}>
                单题重练
              </Button>
            </div>
            {expanded === it.questionId && (
              <div className="mt-3 space-y-1 rounded-xl bg-paper px-3 py-3 text-xs">
                <div>
                  <span className="text-ink/45">你的答案：</span>
                  <span className="text-seal">{it.lastUserAnswerLabel || '—'}</span>
                </div>
                <div>
                  <span className="text-ink/45">正确答案（题库）：</span>
                  <span className="font-medium">{it.correctAnswerLabel || '—'}</span>
                </div>
                {it.lastExamTitle && <div className="text-ink/40">来源：{it.lastExamTitle}</div>}
                <div className="pt-2">
                  <ExplainButton
                    questionId={it.questionId}
                    attemptId={it.lastAttemptId}
                    correctAnswerLabel={it.correctAnswerLabel}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="py-12 text-center text-sm text-ink/40">
            {book?.totalCount ? '该分类暂无错题' : '暂无错题，先去做测验吧'}
          </div>
        )}
      </div>
    </div>
  )
}
