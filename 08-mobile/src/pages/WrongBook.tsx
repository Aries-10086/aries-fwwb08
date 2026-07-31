import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'

type Item = {
  questionId: string
  stem: string
  category: string
  wrongCount: number
  lastExamTitle: string
  lastUserAnswerLabel: string
  correctAnswerLabel: string
}

type Book = { totalCount: number; items: Item[] }

export default function WrongBook() {
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setBook(await apiFetch<Book>('/api/exams/wrong-book/mine'))
      } catch (e: any) {
        setError(e?.message ?? '加载失败')
      }
    })()
  }, [])

  return (
    <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
      <h1 className="pt-2 text-2xl font-bold">错题本</h1>
      <p className="mt-1 text-sm text-ink/50">共 {book?.totalCount ?? 0} 题</p>
      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}
      <div className="mt-4 grid gap-2">
        {(book?.items ?? []).map((it) => (
          <div key={it.questionId} className="m-card p-4">
            <div className="text-sm font-medium leading-snug">{it.stem}</div>
            <div className="mt-1 text-xs text-ink/45">
              {it.category || '未分类'} · 错 {it.wrongCount} 次
            </div>
            <Button
              variant="secondary"
              className="mt-3 !min-h-9 w-full text-xs"
              onClick={() => setExpanded(expanded === it.questionId ? null : it.questionId)}
            >
              {expanded === it.questionId ? '收起' : '查看解析'}
            </Button>
            {expanded === it.questionId && (
              <div className="mt-3 space-y-1 rounded-xl bg-paper px-3 py-3 text-xs">
                <div>
                  <span className="text-ink/45">你的答案：</span>
                  <span className="text-seal">{it.lastUserAnswerLabel || '—'}</span>
                </div>
                <div>
                  <span className="text-ink/45">正确答案：</span>
                  <span className="font-medium">{it.correctAnswerLabel || '—'}</span>
                </div>
                {it.lastExamTitle && <div className="text-ink/40">来源：{it.lastExamTitle}</div>}
              </div>
            )}
          </div>
        ))}
        {(book?.items?.length ?? 0) === 0 && (
          <div className="py-12 text-center text-sm text-ink/40">暂无错题，先去做测验吧</div>
        )}
      </div>
    </div>
  )
}
