import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { friendlyAiError } from '@/utils/aiError'
import { ArrowLeft, CheckCircle, Sparkle } from '@phosphor-icons/react'

type Content = {
  id: string
  type: string
  title: string
  body: string
  category: string
}

type Summary = {
  summary: string
  highlights: string[]
  tips: string[]
  quizQuestions: string[]
}

export default function ContentDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [content, setContent] = useState<Content | null>(null)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [aiSummary, setAiSummary] = useState<Summary | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const startAt = useRef(Date.now())

  useEffect(() => {
    if (!id) return
    startAt.current = Date.now()
    void (async () => {
      try {
        const [data, progress] = await Promise.all([
          apiFetch<Content>(`/api/contents/${id}`),
          apiFetch<{ isCompleted?: boolean }>(`/api/learning/progress?contentId=${encodeURIComponent(id)}`),
        ])
        setContent(data)
        setCompleted(!!progress?.isCompleted)
      } catch (e: any) {
        setError(e?.message ?? '加载失败')
      }
    })()
  }, [id])

  async function markDone() {
    if (!id) return
    setSaving(true)
    try {
      const durationMs = Math.max(1000, Date.now() - startAt.current)
      await apiFetch('/api/learning/record', {
        method: 'POST',
        body: JSON.stringify({ contentId: id, durationMs, isCompleted: true }),
      })
      setCompleted(true)
    } catch (e: any) {
      setError(e?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function loadSummary() {
    if (!id) return
    setAiLoading(true)
    setAiError(null)
    try {
      const data = await apiFetch<Summary>('/api/ai/content-summary', {
        method: 'POST',
        body: JSON.stringify({ contentId: id }),
      })
      const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : [])
      setAiSummary({
        summary: String(data.summary ?? ''),
        highlights: list(data.highlights),
        tips: list(data.tips),
        quizQuestions: list(data.quizQuestions),
      })
    } catch (e: any) {
      setAiError(friendlyAiError(e?.message ?? 'AI 导读失败'))
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="px-4 pb-8 pt-[max(0.75rem,var(--safe-top))]">
      <button type="button" className="inline-flex items-center gap-1 text-sm text-ink/55" onClick={() => nav(-1)}>
        <ArrowLeft size={16} /> 返回
      </button>
      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}
      {content && (
        <>
          <h1 className="mt-3 text-xl font-bold leading-snug text-ink">{content.title}</h1>
          <p className="mt-1 text-xs text-ink/45">{content.category}</p>
          <article className="m-card mt-4 whitespace-pre-wrap p-4 text-sm leading-7 text-ink/80">
            {content.body || '暂无正文'}
          </article>

          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={aiLoading} onClick={() => void loadSummary()}>
              <Sparkle size={16} />
              {aiLoading ? '生成中…' : aiSummary ? '重新导读' : 'AI 导读'}
            </Button>
            <Link to={`/chat?contentId=${encodeURIComponent(content.id)}`} className="flex-1">
              <Button className="w-full">问这篇</Button>
            </Link>
          </div>
          {aiError && <div className="mt-2 rounded-xl bg-seal/10 px-3 py-2 text-xs text-seal-deep">{aiError}</div>}
          {aiSummary && (
            <div className="m-card mt-3 space-y-3 p-4 text-sm leading-6 text-ink/75">
              <p className="whitespace-pre-wrap">{aiSummary.summary}</p>
              {aiSummary.highlights.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-ink">重点知识</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {aiSummary.highlights.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aiSummary.tips.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-ink">学习提示</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {aiSummary.tips.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {completed ? (
              <div className="flex items-center gap-2 text-sm text-[#1f6b4a]">
                <CheckCircle weight="fill" /> 已完成学习
              </div>
            ) : (
              <Button className="w-full" disabled={saving} onClick={() => void markDone()}>
                {saving ? '保存中…' : '标记完成'}
              </Button>
            )}
          </div>
          <Link to="/exams" className="mt-3 block text-center text-sm text-seal">
            去测验 →
          </Link>
        </>
      )}
    </div>
  )
}
