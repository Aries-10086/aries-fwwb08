import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { ArrowLeft, CheckCircle } from '@phosphor-icons/react'

type Content = {
  id: string
  type: string
  title: string
  body: string
  category: string
}

export default function ContentDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [content, setContent] = useState<Content | null>(null)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
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
