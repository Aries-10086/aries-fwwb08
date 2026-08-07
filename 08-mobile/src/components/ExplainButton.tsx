import { useState } from 'react'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { friendlyAiError } from '@/utils/aiError'

type Explanation = {
  explanation: string
  errorReason?: string
  approach?: string
  knowledgePoints?: string[]
  reviewTips?: string[]
  correctAnswerLabel?: string
  userAnswerLabel?: string
}

export function ExplainButton({
  questionId,
  attemptId,
  correctAnswerLabel,
}: {
  questionId: string
  attemptId?: string
  correctAnswerLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Explanation | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    setOpen(true)
    try {
      const res = await apiFetch<Explanation>('/api/ai/wrong-explain', {
        method: 'POST',
        body: JSON.stringify({ questionId, ...(attemptId ? { attemptId } : {}) }),
      })
      setData(res)
    } catch (e: any) {
      setError(friendlyAiError(e?.message ?? '讲解失败'))
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" className="!min-h-9 text-xs" disabled={loading} onClick={() => void load()}>
        {loading ? '生成中…' : 'AI 讲解'}
      </Button>
    )
  }

  const bank = data?.correctAnswerLabel || correctAnswerLabel || '—'

  return (
    <div className="mt-2 rounded-xl bg-seal/5 px-3 py-3 text-xs leading-5">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-ink">AI 讲解</div>
        <button type="button" className="text-seal" onClick={() => void load()} disabled={loading}>
          {loading ? '…' : '重新生成'}
        </button>
      </div>
      <div className="mt-2 rounded-lg bg-white px-2 py-2">
        <span className="text-ink/45">正确答案（题库只读）：</span>
        <span className="font-medium">{bank}</span>
        <div className="mt-0.5 text-[10px] text-ink/35">AI 仅解释，不修改标准答案</div>
      </div>
      {error && <div className="mt-2 text-seal-deep">{error}</div>}
      {data && !error && (
        <div className="mt-2 space-y-1.5 text-ink/75">
          {data.userAnswerLabel && (
            <div>
              <span className="text-ink/45">你的答案：</span>
              {data.userAnswerLabel}
            </div>
          )}
          {data.explanation && <p className="whitespace-pre-wrap">{data.explanation}</p>}
          {data.errorReason && (
            <div>
              <span className="font-medium text-ink">错误原因：</span>
              {data.errorReason}
            </div>
          )}
          {data.approach && (
            <div>
              <span className="font-medium text-ink">解题思路：</span>
              {data.approach}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
