import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { withAccessToken } from '@/utils/fileLink'
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Paperclip,
  ChatCircleDots,
  CircleNotch,
  Sparkle,
} from '@phosphor-icons/react'
import type { AIContentSummary, Content } from '../../shared/types'

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
  const [aiSummary, setAiSummary] = useState<AIContentSummary | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
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
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
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
      // 离开页面时记录失败不阻塞导航。
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

  async function generateSummary() {
    if (!id) return
    setAiLoading(true)
    setAiError(null)
    try {
      const data = await apiFetch<AIContentSummary>('/api/ai/content-summary', {
        method: 'POST',
        body: JSON.stringify({ contentId: id }),
      })
      const list = (value: unknown) => Array.isArray(value) ? value.map(String) : value ? [String(value)] : []
      setAiSummary({
        summary: String(data.summary ?? ''),
        highlights: list(data.highlights),
        tips: list(data.tips),
        quizQuestions: list(data.quizQuestions),
      })
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI 导读生成失败')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="hero-frame px-6 py-7 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="page-eyebrow">学习内容</div>
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
              <CheckCircle className="h-4 w-4" />
              {completed ? '已完成' : '标记完成'}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Sparkle className="h-5 w-5 text-[#9e1b2b]" />
              AI 导读
            </span>
            <div className="flex flex-wrap gap-2">
              {id && (
                <Link to={`/m/chat?contentId=${encodeURIComponent(id)}`}>
                  <Button variant="secondary" className="px-3 py-2 text-xs">
                    <ChatCircleDots className="h-4 w-4" />
                    问这篇
                  </Button>
                </Link>
              )}
              <Button
                className="px-3 py-2 text-xs"
                disabled={!content || aiLoading}
                onClick={() => void generateSummary()}
              >
                {aiLoading && <CircleNotch className="h-4 w-4 animate-spin" />}
                {aiLoading ? '生成中…' : aiSummary ? '重新生成' : '生成导读'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aiError && <div className="text-sm text-[#741220]">{aiError}</div>}
          {!aiSummary && !aiError && (
            <p className="text-sm text-zinc-500">快速了解内容摘要、重点知识和自测问题。</p>
          )}
          {aiSummary && (
            <div className="grid gap-4 text-sm leading-7 text-[rgba(18,21,28,0.72)]">
              <p className="whitespace-pre-wrap">{aiSummary.summary}</p>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ['重点知识', aiSummary.highlights],
                  ['学习提示', aiSummary.tips],
                  ['自测问题', aiSummary.quizQuestions],
                ].map(([title, values]) => (
                  <section key={title as string} className="rounded-xl bg-[rgba(158,27,43,0.04)] p-4">
                    <h3 className="font-semibold text-[#12151c]">{title as string}</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {(values as string[]).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>{content?.type === 'video' ? '视频内容' : '文章内容'}</span>
            <span className="data-pill">
              <Clock className="h-3 w-3 text-[#9e1b2b]" />
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
                    className="text-sm text-[#9e1b2b] hover:underline"
                    rel="noreferrer"
                  >
                    在新窗口打开原链接
                  </a>
                </div>
              ) : null}
              {bodyText ? (
                <div className="whitespace-pre-wrap rounded-[24px] bg-white/90 px-5 py-5 text-sm leading-8 text-[rgba(18,21,28,0.72)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                  {bodyText}
                </div>
              ) : null}
              {(content.attachments?.length ?? 0) > 0 && (
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#12151c]">
                    <Paperclip className="h-4 w-4 text-[#9e1b2b]" />
                    附件下载
                  </div>
                  {content.attachments!.map((att) => (
                    <a
                      key={att.id}
                      href={withAccessToken(att.url, token)}
                      target="_blank"
                      rel="noreferrer"
                      className="list-surface text-sm text-[#9e1b2b] hover:bg-[rgba(158,27,43,0.05)]"
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
