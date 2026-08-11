import { View, Text } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import './index.scss'

type Item = {
  questionId: string
  stem: string
  category: string
  wrongCount: number
  lastExamTitle: string
  lastUserAnswerLabel: string
  correctAnswerLabel: string
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
}

type PracticeDetail = {
  questionId: string
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
    toMastered: boolean
    removed: boolean
    backToPending: boolean
  }>
}

export default function WrongBookPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const tabPath = user?.role === 'secretary' ? '/pages/scores/index' : '/pages/wrong-book/index'
  const fromScores = router.params.from === 'scores'
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'mastered'>('all')
  const [view, setView] = useState<'list' | 'practice' | 'result'>('list')
  const [practiceQs, setPracticeQs] = useState<PracticeQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loadingPractice, setLoadingPractice] = useState(false)
  const [result, setResult] = useState<PracticeResult | null>(null)

  async function loadBook() {
    try {
      setBook(await apiFetch<Book>('/api/exams/wrong-book/mine'))
    } catch (e: any) {
      setError(e?.message ?? '内容加载失败，请您稍后重试')
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
    setLoadingPractice(true)
    try {
      const qs = ids?.length ? `?ids=${encodeURIComponent(ids.join(','))}` : ''
      const data = await apiFetch<{ questions: PracticeQuestion[] }>(`/api/exams/wrong-book/practice${qs}`)
      if (!data.questions?.length) {
        setError('暂无可重练的错题，感谢您的坚持')
        return
      }
      setPracticeQs(data.questions)
      setAnswers({})
      setResult(null)
      setView('practice')
    } catch (e: any) {
      setError(e?.message ?? '重练题目加载失败，请您稍后重试')
    } finally {
      setLoadingPractice(false)
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
      setError(e?.message ?? '提交未成功，请您核对后重试')
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

  const progressSummary = useMemo(() => {
    if (!result?.progressUpdates?.length) return null
    return {
      toMastered: result.progressUpdates.filter((u) => u.toMastered).length,
      removed: result.progressUpdates.filter((u) => u.removed).length,
      backToPending: result.progressUpdates.filter((u) => u.backToPending).length,
    }
  }, [result])

  function renderQuestionInputs(q: PracticeQuestion, idx: number) {
    return (
      <View key={q.questionId} className="m-card wb-practice-q">
        <Text className="wb-practice-q__stem">
          {idx + 1}. {q.stem}
        </Text>
        {q.type === 'tf' && (
          <View className="wb-tf">
            {[
              { label: '正确', value: true },
              { label: '错误', value: false },
            ].map((it) => (
              <View
                key={it.label}
                className={`wb-opt ${answers[q.questionId] === it.value ? 'is-on' : ''}`}
                onClick={() => setAnswers((p) => ({ ...p, [q.questionId]: it.value }))}
              >
                <Text>{it.label}</Text>
              </View>
            ))}
          </View>
        )}
        {(q.type === 'single' || q.type === 'multiple') && (
          <View className="wb-opts">
            {(q.options ?? []).map((op) => {
              const selected = answers[q.questionId]
              const checked =
                q.type === 'single'
                  ? selected === op.key
                  : Array.isArray(selected) && selected.includes(op.key)
              return (
                <View
                  key={op.key}
                  className={`wb-opt wb-opt--block ${checked ? 'is-soft' : ''}`}
                  onClick={() => {
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
                >
                  <Text>
                    <Text className="wb-opt__key">{op.key}. </Text>
                    {op.text}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </View>
    )
  }

  if (view === 'practice') {
    return (
      <PageShell>
        <View className="wb-practice-head">
          <Text className="wb-back" onClick={backToList}>
            ← 请返回错题本
          </Text>
        </View>
        <Text className="m-title">错题重练</Text>
        <Text className="m-sub">共 {practiceQs.length} 题 · 本次练习不计入正式成绩</Text>
        {error && <View className="m-error">{error}</View>}
        <View className="wb-practice-list">{practiceQs.map(renderQuestionInputs)}</View>
        <View className="wb-practice-actions">
          <Button loading={submitting} onClick={() => void submitPractice()}>
            {submitting ? '正在提交…' : '请提交自测'}
          </Button>
        </View>
      </PageShell>
    )
  }

  if (view === 'result' && result) {
    const wrongIds = result.details.filter((d) => !d.isCorrect).map((d) => d.questionId)
    return (
      <PageShell>
        <View className="wb-practice-head">
          <Text className="wb-back" onClick={backToList}>
            ← 请返回错题本
          </Text>
        </View>
        <Text className="m-title">重练结果</Text>
        <Text className="m-sub">
          答对 {result.correctCount} 题 · 答错 {result.wrongCount} 题 · 共 {result.totalCount} 题
        </Text>
        {progressSummary &&
          (progressSummary.toMastered > 0 ||
            progressSummary.removed > 0 ||
            progressSummary.backToPending > 0) && (
            <View className="wb-progress-tip">
              {progressSummary.toMastered > 0 && (
                <Text>恭喜，{progressSummary.toMastered} 题已进入「已掌握」</Text>
              )}
              {progressSummary.removed > 0 && (
                <Text>感谢您的坚持，{progressSummary.removed} 题已移出错题本</Text>
              )}
              {progressSummary.backToPending > 0 && (
                <Text>{progressSummary.backToPending} 题已回到「待复习」，请您继续加油</Text>
              )}
            </View>
          )}
        <View className="wb-result-list">
          {result.details.map((d, idx) => (
            <View key={d.questionId} className={`m-card wb-result-item ${d.isCorrect ? 'is-ok' : 'is-bad'}`}>
              <Text className="wb-result-item__stem">
                {idx + 1}. {d.stem}
              </Text>
              <Text className="wb-result-item__line">
                您的作答：
                <Text className={d.isCorrect ? 'ok' : 'bad'}>{d.userAnswerLabel}</Text>
              </Text>
              {!d.isCorrect && (
                <Text className="wb-result-item__line">
                  参考答案：
                  <Text>{d.correctAnswerLabel}</Text>
                </Text>
              )}
            </View>
          ))}
        </View>
        <View className="wb-practice-actions">
          {wrongIds.length > 0 && (
            <Button loading={loadingPractice} onClick={() => void startPractice(wrongIds)}>
              请再练错题（{wrongIds.length}）
            </Button>
          )}
          <Button variant="secondary" onClick={() => void startPractice(practiceQs.map((q) => q.questionId))}>
            请全部再练一遍
          </Button>
          <Button variant="secondary" onClick={backToList}>
            请返回错题本
          </Button>
        </View>
      </PageShell>
    )
  }

  return (
    <PageShell tabPath={tabPath}>
      {fromScores && user?.role === 'secretary' && (
        <Text className="wb-back" onClick={() => Taro.navigateBack()}>
          ← 请返回学习服务
        </Text>
      )}
      <View className="wb-head">
        <Text className="m-title">错题本</Text>
        <Text className="wb-head__count">共 {book?.totalCount ?? 0} 题</Text>
        <Text className="wb-head__hint">请您知悉：答对 1 次进入「已掌握」，连续答对 2 次后移出错题本</Text>
        {(book?.totalCount ?? 0) > 0 && (
          <Button className="wb-head__action" loading={loadingPractice} onClick={() => void startPractice()}>
            请开始重练
          </Button>
        )}
      </View>
      {error && <View className="m-error">{error}</View>}

      <View className="wb-tabs">
        {(
          [
            ['all', '全部', book?.totalCount ?? 0],
            ['pending', '待复习', book?.pendingCount ?? 0],
            ['mastered', '已掌握', book?.masteredCount ?? 0],
          ] as const
        ).map(([key, label, count]) => (
          <View
            key={key}
            className={`wb-tab ${statusTab === key ? 'is-on' : ''}`}
            onClick={() => setStatusTab(key)}
          >
            <Text>
              {label} ({count})
            </Text>
          </View>
        ))}
      </View>

      <View className="wb-list">
        {filteredItems.map((it) => (
          <View key={it.questionId} className="m-card wb-card">
            <Text className="wb-card__stem">{it.stem}</Text>
            <Text className="wb-card__meta">
              {it.category || '未分类'} · 错 {it.wrongCount} 次 ·{' '}
              {it.reviewStatus === 'mastered' ? '已掌握' : '待复习'}
            </Text>
            <View className="wb-card__actions">
              <Button
                variant="secondary"
                className="wb-card__action"
                onClick={() => setExpanded(expanded === it.questionId ? null : it.questionId)}
              >
                {expanded === it.questionId ? '请收起' : '请查看解析'}
              </Button>
              <Button
                className="wb-card__action"
                loading={loadingPractice}
                onClick={() => void startPractice([it.questionId])}
              >
                请重新作答
              </Button>
            </View>
            {expanded === it.questionId && (
              <View className="wb-explain">
                <Text>
                  您的作答：
                  <Text className="seal">{it.lastUserAnswerLabel || '—'}</Text>
                </Text>
                <Text>
                  参考答案：
                  <Text style={{ fontWeight: 500 }}>{it.correctAnswerLabel || '—'}</Text>
                </Text>
                {it.lastExamTitle ? <Text className="wb-card__meta">来源：{it.lastExamTitle}</Text> : null}
              </View>
            )}
          </View>
        ))}
        {filteredItems.length === 0 && (
          <View className="m-empty">
            {book?.totalCount ? '该分类暂无错题，请您切换其他分类查看' : '暂无错题，欢迎您先完成测验'}
          </View>
        )}
      </View>
    </PageShell>
  )
}
