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

function toEmbedUrl(url: string): { kind: 'iframe' | 'video'; src: string } | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')

    if (host.includes('youtube.com') || host === 'youtu.be') {
      const id = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v')
      if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${id}` }
    }
    if (host.includes('bilibili.com')) {
      const m = u.pathname.match(/\/video\/(BV[\w]+)/i)
      if (m?.[1]) return { kind: 'iframe', src: `https://player.bilibili.com/player.html?bvid=${m[1]}&high_quality=1` }
    }
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(u.pathname) || u.pathname.includes('/uploads/')) {
      return { kind: 'video', src: url }
    }
    // 其它直链尝试用 video；失败仍可在下方展示外链
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return { kind: 'video', src: url }
    }
  } catch {
    return null
  }
  return null
}

export default function ContentDetail() {
  const nav = useNavigate()
  const { id } = useParams()
  const { user, token } = useAuthStore()
  const [content, setContent] = useState<Content | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const startAt = useRef<number>(Date.now())
  const completedRef = useRef(false)
  const recordedOnLeave = useRef(false)

  useEffect(() => {
    if (!user) nav('/login')
  }, [nav, user])

  async function load() {
    if (!id) return
    setError(null)
    recordedOnLeave.current = false
    try {
      const [data, progress] = await Promise.all([
        apiFetch<Content>(`/api/contents/${id}`),
        apiFetch<{ contentId: string; durationMs: number; isCompleted: boolean }>(
          `/api/learning/progress?contentId=${encodeURIComponent(id)}`,
        ),
      ])
      setContent(data)
      const done = !!progress?.isCompleted
      setCompleted(done)
      completedRef.current = done
      startAt.current = Date.now()
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }

  async function record(isCompleted: boolean, durationOverride?: number) {
    if (!id || !user) return
    const durationMs =
      durationOverride ?? Math.max(0, Date.now() - startAt.current)
    // 标记完成后重置计时，避免重复累计本段时长
    startAt.current = Date.now()
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
      if (recordedOnLeave.current) return
      recordedOnLeave.current = true
      // 离开页只记时长，完成态用 ref（避免闭包拿到旧 completed）
      void record(completedRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const videoUrl = useMemo(() => {
    if (!content || content.type !== 'video') return null
    const firstLine = content.body.split('\n')[0].trim()
    return firstLine.startsWith('http') ? firstLine : null
  }, [content])

  const embed = useMemo(() => (videoUrl ? toEmbedUrl(videoUrl) : null), [videoUrl])

  const bodyText = useMemo(() => {
    if (!content) return ''
    if (content.type === 'video' && videoUrl) {
      const lines = content.body.split('\n')
      return lines.slice(1).join('\n').trim() || content.body
    }
    return content.body
  }, [content, videoUrl])

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
                completedRef.current = true
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
        <div className="rounded-2xl bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020] shadow-[inset_0_0_0_1px_rgba(163,24,40,0.16)]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>{content?.type === 'video' ? '视频内容' : '文章内容'}</span>
            <span className="data-pill">
              <Clock className="h-3 w-3 text-[#a31828]" />
              学习时长将自动统计
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {content ? (
            <div className="grid gap-4">
              {content.type === 'video' && videoUrl ? (
                <div className="grid gap-3">
                  {embed?.kind === 'iframe' ? (
                    <div className="aspect-video overflow-hidden rounded-[24px] bg-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]">
                      <iframe
                        title={content.title}
                        src={embed.src}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : embed?.kind === 'video' ? (
                    <video
                      controls
                      className="aspect-video w-full rounded-[24px] bg-black object-contain shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
                      src={embed.src.startsWith('/api/files') ? withAccessToken(embed.src, token) : embed.src}
                    >
                      您的浏览器不支持视频播放
                    </video>
                  ) : null}
                  <a
                    href={videoUrl}
                    target="_blank"
                    className="text-sm text-[#a31828] hover:underline"
                    rel="noreferrer"
                  >
                    在新窗口打开原链接
                  </a>
                </div>
              ) : null}
              {bodyText ? (
                <div className="whitespace-pre-wrap rounded-[24px] bg-white/90 px-5 py-5 text-sm leading-8 text-[rgba(14,17,22,0.72)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                  {bodyText}
                </div>
              ) : null}
              {(content.attachments?.length ?? 0) > 0 && (
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#0e1116]">
                    <Paperclip className="h-4 w-4 text-[#a31828]" />
                    附件下载
                  </div>
                  {content.attachments!.map((att) => (
                    <a
                      key={att.id}
                      href={withAccessToken(att.url, token)}
                      target="_blank"
                      rel="noreferrer"
                      className="list-surface text-sm text-[#a31828] hover:bg-[rgba(163,24,40,0.05)]"
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
