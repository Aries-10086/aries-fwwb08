import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { withAccessToken } from '@/utils/fileLink'
import { ArrowLeft, CheckCircle2, Clock, Paperclip } from 'lucide-react'

type Attachment = {
  id: string
  name: string
  url: string
  size: number
  mime: string
}

type Content = {
  id: string
  type: 'article' | 'video'
  title: string
  body: string
  category: string
  tags: string[]
  attachments?: Attachment[]
  isPublic: boolean
}

export default function ContentDetail() {
  const nav = useNavigate()
  const { id } = useParams()
  const { user, token } = useAuthStore()
  const [content, setContent] = useState<Content | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const startAt = useRef<number>(Date.now())

  useEffect(() => {
    if (!user) nav('/login')
  }, [nav, user])

  async function load() {
    if (!id) return
    setError(null)
    try {
      const data = await apiFetch<Content>(`/api/contents/${id}`)
      setContent(data)
      startAt.current = Date.now()
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }

  async function record(isCompleted: boolean) {
    if (!id || !user) return
    const durationMs = Math.max(0, Date.now() - startAt.current)
    try {
      await apiFetch<{ id: string }>('/api/learning/record', {
        method: 'POST',
        body: JSON.stringify({ contentId: id, durationMs, isCompleted }),
      })
    } catch {
      null
    }
  }

  useEffect(() => {
    load()
    return () => {
      record(completed)
    }
  }, [id])

  const videoUrl = useMemo(() => {
    if (!content || content.type !== 'video') return null
    const firstLine = content.body.split('\n')[0].trim()
    return firstLine.startsWith('http') ? firstLine : null
  }, [content])

  return (
    <div className="grid gap-6">
      <div className="hero-frame px-6 py-7 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="page-eyebrow">Learning Content</div>
            <h1 className="page-title text-3xl md:text-5xl">{content?.title ?? '加载中…'}</h1>
            {content && <div className="page-subtitle mt-2 max-w-2xl">{content.category}</div>}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/m/home">
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" />
                返回
              </Button>
            </Link>
            <Button
              variant={completed ? 'success' : 'primary'}
              disabled={completed}
              onClick={async () => {
                setCompleted(true)
                await record(true)
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              {completed ? '已完成' : '标记完成'}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[#b91c1c]/10 px-4 py-3 text-[#7f1d1d] shadow-[inset_0_0_0_1px_rgba(185,28,28,0.16)]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>{content?.type === 'video' ? '视频内容' : '文章内容'}</span>
            <span className="data-pill">
              <Clock className="h-3 w-3 text-[#8c2424]" />
              学习时长将自动统计
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {content ? (
            <div className="grid gap-4">
              {content.type === 'video' && videoUrl ? (
                <a
                  href={videoUrl}
                  target="_blank"
                  className="list-surface text-sm text-black/75 hover:bg-[#8c2424]/5"
                  rel="noreferrer"
                >
                  打开视频链接：{videoUrl}
                </a>
              ) : null}
              <div className="whitespace-pre-wrap rounded-[24px] bg-white/90 px-5 py-5 text-sm leading-8 text-black/75 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                {content.body}
              </div>
              {(content.attachments?.length ?? 0) > 0 && (
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
                    <Paperclip className="h-4 w-4 text-[#8c2424]" />
                    附件下载
                  </div>
                  {content.attachments!.map((att) => (
                    <a
                      key={att.id}
                      href={withAccessToken(att.url, token)}
                      target="_blank"
                      rel="noreferrer"
                      className="list-surface text-sm text-[#8c2424] hover:bg-[#8c2424]/5"
                    >
                      {att.name}
                    </a>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {(content.tags ?? []).map((t) => (
                  <span key={t} className="data-pill">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-10 text-sm text-zinc-400">暂无内容</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
