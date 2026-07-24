import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Circle,
  ClipboardText,
  MagnifyingGlass,
  Sparkle,
} from '@phosphor-icons/react'

type Content = {
  id: string
  type: 'article' | 'video'
  title: string
  category: string
  tags: string[]
  isPublic: boolean
}

type TaskContentItem = {
  id: string
  title: string
  type: string
  isCompleted: boolean
}

type Task = {
  id: string
  title: string
  dueAt: string | null
  contentIds: string[]
  contents?: TaskContentItem[]
  completedCount?: number
  totalCount?: number
  progressPercent?: number
  isCompleted?: boolean
}

type ProgressItem = {
  contentId: string
  durationMs: number
  isCompleted: boolean
}

export default function MobileHome() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [progress, setProgress] = useState<ProgressItem[]>([])
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [rec, setRec] = useState<{ text: string; items: Content[]; weakCategories: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role === 'admin') nav('/admin/dashboard')
  }, [nav, user])

  async function load(q = '') {
    setError(null)
    setSearching(!!q.trim())
    try {
      const qParam = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''
      const [t, c, p] = await Promise.all([
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<Content[]>(`/api/contents?isPublic=1${qParam}`),
        apiFetch<ProgressItem[]>('/api/learning/progress'),
      ])
      setTasks(t)
      setContents(c)
      setProgress(Array.isArray(p) ? p : [])
      if (!q.trim()) {
        const r = await apiFetch<any>('/api/ai/recommend', {
          method: 'POST',
          body: JSON.stringify({ userId: user?.id }),
        })
        setRec(r)
      }
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const completedSet = useMemo(
    () => new Set(progress.filter((x) => x.isCompleted).map((x) => x.contentId)),
    [progress],
  )

  const publicTop = useMemo(() => contents.slice(0, query.trim() ? 20 : 6), [contents, query])
  const doneCount = completedSet.size

  return (
    <div className="grid gap-6">
      <div className="hero-frame px-6 py-7 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="page-eyebrow">党员端</div>
            <h1 className="page-title text-3xl md:text-5xl">学习首页</h1>
            <div className="page-subtitle mt-2 max-w-2xl">
              把组织要求、公共内容与 AI 个性化建议汇聚到一个入口，帮助学员更顺畅地完成当期学习任务。
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/m/exams">
              <Button variant="secondary">
                <ClipboardText className="h-4 w-4" />
                去测验
              </Button>
            </Link>
            <Link to="/m/report">
              <Button>
                <Sparkle className="h-4 w-4" />
                AI 报告
              </Button>
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            ['当前任务', `${tasks.length}`],
            ['已完成', `${doneCount}`],
            ['AI 推荐', rec ? `${rec.items.length}` : '…'],
          ].map(([label, value]) => (
            <div key={label} className="panel-muted px-4 py-4">
              <div className="text-[11px] tracking-[0.16em] text-[#9e1b2b]">{label}</div>
              <div className="metric-value mt-3 text-[#12151c]">{value}</div>
            </div>
          ))}
        </div>
        <form
          className="mt-6 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void load(query)
          }}
        >
          <div className="input-shell flex min-w-[240px] flex-1 items-center gap-2 px-3">
            <MagnifyingGlass className="h-4 w-4 text-[#9e1b2b]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索公共学习内容（标题 / 分类 / 标签）"
              className="w-full bg-transparent py-2.5 text-sm outline-none"
            />
          </div>
          <Button type="submit" disabled={searching}>
            {searching ? '搜索中…' : '搜索'}
          </Button>
          {query.trim() && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setQuery('')
                void load('')
              }}
            >
              清空
            </Button>
          )}
        </form>
      </div>

      {error && (
        <div role="alert" className="border border-[rgba(158,27,43,0.2)] bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#9e1b2b]" />
              学习任务
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {tasks.map((t) => {
                const items =
                  t.contents && t.contents.length > 0
                    ? t.contents
                    : t.contentIds.map((cid) => ({
                        id: cid,
                        title: cid,
                        type: 'article',
                        isCompleted: completedSet.has(cid),
                      }))
                const total = t.totalCount ?? items.length
                const done = t.completedCount ?? items.filter((x) => x.isCompleted).length
                const percent = t.progressPercent ?? (total > 0 ? Math.round((done / total) * 100) : 0)
                const allDone = t.isCompleted ?? (total > 0 && done === total)
                return (
                  <div key={t.id} className="list-surface">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {allDone ? (
                            <CheckCircle className="h-4 w-4 shrink-0 text-[#1f6b4a]" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-[rgba(18,21,28,0.28)]" />
                          )}
                          <div className="truncate text-sm font-medium text-[#12151c]">{t.title}</div>
                        </div>
                        <div className="mt-1 text-xs text-[rgba(18,21,28,0.55)]">
                          {allDone ? '已完成' : `进度 ${done}/${total}`}
                          {t.dueAt ? ` · 截止 ${new Date(t.dueAt).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-[#9e1b2b]">{percent}%</div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(18,21,28,0.06)]">
                      <div
                        className={[
                          'h-full rounded-full transition-all',
                          allDone ? 'bg-[#1f6b4a]' : 'bg-[#9e1b2b]',
                        ].join(' ')}
                        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                      />
                    </div>
                    <div className="mt-3 grid gap-2">
                      {items.map((item) => (
                        <Link
                          key={item.id}
                          to={`/m/content/${item.id}`}
                          className={[
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition',
                            'shadow-[inset_0_0_0_1px_rgba(18,21,28,0.06)]',
                            item.isCompleted
                              ? 'bg-[rgba(31,107,74,0.06)] hover:bg-[rgba(31,107,74,0.1)]'
                              : 'bg-white/80 hover:bg-[rgba(158,27,43,0.05)]',
                          ].join(' ')}
                        >
                          {item.isCompleted ? (
                            <CheckCircle className="h-4 w-4 shrink-0 text-[#1f6b4a]" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-[rgba(18,21,28,0.28)]" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[#12151c]">{item.title}</div>
                            <div className="mt-0.5 text-[11px] text-[rgba(18,21,28,0.45)]">
                              {item.isCompleted ? '已完成' : '未完成'} · {item.type === 'video' ? '视频' : '文章'}
                            </div>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[rgba(18,21,28,0.35)]" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
              {tasks.length === 0 && <div className="py-8 text-sm text-zinc-400">暂无学习任务</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkle className="h-5 w-5 text-[#9e1b2b]" />
              AI 推荐
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rec ? (
              <div className="grid gap-4">
                <div className="list-surface text-sm leading-relaxed text-[rgba(18,21,28,0.72)]">{rec.text}</div>
                <div className="grid gap-2">
                  {rec.items.slice(0, 5).map((c) => (
                    <Link
                      key={c.id}
                      to={`/m/content/${c.id}`}
                      className="list-surface flex items-center justify-between hover:bg-[rgba(158,27,43,0.05)]"
                    >
                      <div>
                        <div className="text-sm font-medium text-[#12151c]">{c.title}</div>
                        <div className="mt-1 text-xs text-[rgba(18,21,28,0.55)]">
                          {c.category}
                          {completedSet.has(c.id) ? ' · 已完成' : ''}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[rgba(18,21,28,0.4)]" />
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-sm text-zinc-400">正在生成推荐…</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{query.trim() ? `搜索结果（${contents.length}）` : '公共内容'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {publicTop.map((c) => (
              <Link key={c.id} to={`/m/content/${c.id}`} className="list-surface hover:bg-[rgba(158,27,43,0.05)]">
                <div className="text-sm font-medium text-[#12151c]">{c.title}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-[rgba(18,21,28,0.55)]">
                  <span>
                    {c.category}
                    {completedSet.has(c.id) ? ' · 已学' : ' · 未学'}
                  </span>
                  <span>{c.type === 'video' ? '视频' : '文章'}</span>
                </div>
              </Link>
            ))}
            {publicTop.length === 0 && (
              <div className="py-10 text-sm text-zinc-400">{query.trim() ? '无匹配内容' : '暂无公共内容'}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
