import { useState } from 'react'
import { Brain, CircleNotch, Lightbulb, Sparkle } from '@phosphor-icons/react'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { friendlyAiError } from '@/utils/aiError'
import type { AIQuestionExplanation } from '../../shared/types'

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function optionalString(value: unknown): string | undefined {
  return value == null ? undefined : String(value)
}

function normalizeExplanation(value: unknown): AIQuestionExplanation {
  const data = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {}
  return {
    explanation: String(data.explanation ?? data.text ?? data.summary ?? ''),
    errorReason: optionalString(data.errorReason ?? data.reason),
    approach: optionalString(data.approach ?? data.solution),
    knowledgePoints: stringList(data.knowledgePoints ?? data.points),
    reviewTips: stringList(data.reviewTips ?? data.suggestions ?? data.tips),
    correctAnswer: data.correctAnswer,
    correctAnswerLabel: optionalString(data.correctAnswerLabel),
    userAnswerLabel: optionalString(data.userAnswerLabel),
    answerSource: 'question_bank',
    answerMutable: false,
  }
}

export function QuestionExplainPanel({
  questionId,
  attemptId,
  compact = false,
  correctAnswerLabel: correctAnswerLabelProp,
}: {
  questionId: string
  attemptId?: string
  compact?: boolean
  /** 父组件已展示的题库答案（可选，接口也会返回） */
  correctAnswerLabel?: string
}) {
  const [explanation, setExplanation] = useState<AIQuestionExplanation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bankLabel = explanation?.correctAnswerLabel || correctAnswerLabelProp

  async function explain() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<AIQuestionExplanation>('/api/ai/wrong-explain', {
        method: 'POST',
        body: JSON.stringify({ questionId, ...(attemptId ? { attemptId } : {}) }),
      })
      setExplanation(normalizeExplanation(data))
    } catch (e) {
      setError(friendlyAiError(e instanceof Error ? e.message : 'AI 讲解生成失败'))
    } finally {
      setLoading(false)
    }
  }

  if (!explanation && !error) {
    return (
      <Button
        variant="secondary"
        className={compact ? 'px-3 py-2 text-xs' : undefined}
        disabled={loading}
        onClick={() => void explain()}
      >
        {loading ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Sparkle className="h-4 w-4" />}
        {loading ? '正在生成讲解…' : 'AI 讲解'}
      </Button>
    )
  }

  return (
    <section className="mt-3 rounded-xl bg-[rgba(158,27,43,0.04)] p-4 shadow-[inset_0_0_0_1px_rgba(158,27,43,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#12151c]">
          <Brain className="h-4 w-4 text-[#9e1b2b]" />
          AI 讲解
        </h3>
        <button
          type="button"
          onClick={() => void explain()}
          disabled={loading}
          className="min-h-9 text-xs text-[#9e1b2b] hover:underline disabled:opacity-50"
        >
          重新生成
        </button>
      </div>
      <div className="mt-2 rounded-lg bg-white/90 px-3 py-2 text-xs text-[rgba(18,21,28,0.65)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]">
        <span className="font-semibold text-[#12151c]">正确答案（题库只读）</span>
        <span className="ml-2">{bankLabel || '—'}</span>
        <div className="mt-1 text-[11px] text-[rgba(18,21,28,0.45)]">
          AI 仅解释，不修改标准答案
        </div>
      </div>
      {error ? (
        <div className="mt-3 text-sm text-[#741220]">{error}</div>
      ) : (
        <div className="mt-3 grid gap-3 text-sm leading-7 text-[rgba(18,21,28,0.72)]">
          {explanation?.userAnswerLabel && (
            <div>
              <span className="font-semibold text-[#12151c]">你的答案：</span>
              {explanation.userAnswerLabel}
            </div>
          )}
          {explanation?.explanation && <p className="whitespace-pre-wrap">{explanation.explanation}</p>}
          {explanation?.errorReason && (
            <div><span className="font-semibold text-[#12151c]">错误原因：</span>{explanation.errorReason}</div>
          )}
          {explanation?.approach && (
            <div><span className="font-semibold text-[#12151c]">解题思路：</span>{explanation.approach}</div>
          )}
          {explanation && (explanation.knowledgePoints.length > 0 || explanation.reviewTips.length > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              {explanation.knowledgePoints.length > 0 && (
                <div className="rounded-lg bg-white/80 p-3">
                  <div className="flex items-center gap-1.5 font-semibold text-[#12151c]">
                    <Lightbulb className="h-4 w-4 text-[#9e1b2b]" />相关知识点
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {explanation.knowledgePoints.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              )}
              {explanation.reviewTips.length > 0 && (
                <div className="rounded-lg bg-white/80 p-3">
                  <div className="font-semibold text-[#12151c]">复习建议</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {explanation.reviewTips.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
