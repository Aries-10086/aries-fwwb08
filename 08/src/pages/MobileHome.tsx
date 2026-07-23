import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ArrowRight, BookOpen, ClipboardList, Search, Sparkles } from 'lucide-react'

type Content = {
  id: string
  type: 'article' | 'video'
  title: string
  category: string
  tags: string[]
  isPublic: boolean
}

type Task = {
  id: string
  title: string
  dueAt: string | null
  contentIds: string[]
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
            <div className="page-eyebrow">Member Portal</div>
            <h1 className="page-title text-3xl md:text-5xl">学习首页</h1>
            <div className="page-subtitle mt-2 max-w-2xl">
              把组织要求、公共内容与 AI 个性化建议汇聚到一个入口，帮助学员更顺畅地完成当期学习任务。
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/m/exams">
              <Button variant="secondary">
                <ClipboardList className="h-4 w-4" />
                去测验
              </Button>
            </Link>
            <Link to="/m/report">
              <Button>
                <Sparkles className="h-4 w-4" />
                AI 报告
              </Button>
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            ['当前任务', `${tasks.length} 项待学习`],
            ['学习进度', `已完成 ${doneCount} 项`],
            ['AI 推荐', rec ? `${rec.items.length} 条建议` : '生成中'],
          ].map(([label, value]) => (
            <div key={label} className="panel-muted rounded-2xl px-4 py-4">
              <div className="text-xs uppercase tracking-[0.28em] text-[#a31828]/60">{label}</div>
              <div className="mt-3 text-2xl font-black tracking-[-0.05em] text-[#0e1116]">{value}</div>
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
            <Search className="h-4 w-4 text-[#a31828]" />
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
        <div className="rounded-2xl bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020] shadow-[inset_0_0_0_1px_rgba(163,24,40,0.16)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#a31828]" />
              学习任务
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {tasks.map((t) => {
                const doneInTask = t.contentIds.filter((cid) => completedSet.has(cid)).length
                return (
                  <div key={t.id} className="list-surface">
                    <div className="text-sm font-medium text-[#0e1116]">{t.title}</div>
                    <div className="mt-1 text-xs text-[rgba(14,17,22,0.55)]">
                      进度 {doneInTask}/{t.contentIds.length}
                      {t.dueAt ? ` · 截止 ${new Date(t.dueAt).toLocaleDateString()}` : ''}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {t.contentIds.slice(0, 3).map((cid) => (
                        <Link key={cid} to={`/m/content/${cid}`}>
                          <Button variant="ghost" className="px-3 py-1.5 text-xs">
                            {completedSet.has(cid) ? '已学 · 打开' : '打开内容'}
                            <ArrowRight className="h-3 w-3" />
                          </Button>
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
              <Sparkles className="h-5 w-5 text-[#a31828]" />
              AI 推荐
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rec ? (
              <div className="grid gap-4">
                <div className="list-surface text-sm leading-relaxed text-[rgba(14,17,22,0.72)]">{rec.text}</div>
                <div className="grid gap-2">
                  {rec.items.slice(0, 5).map((c) => (
                    <Link
                      key={c.id}
                      to={`/m/content/${c.id}`}
                      className="list-surface flex items-center justify-between hover:bg-[rgba(163,24,40,0.05)]"
                    >
                      <div>
                        <div className="text-sm font-medium text-[#0e1116]">{c.title}</div>
                        <div className="mt-1 text-xs text-[rgba(14,17,22,0.55)]">
                          {c.category}
                          {completedSet.has(c.id) ? ' · 已完成' : ''}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[rgba(14,17,22,0.4)]" />
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
              <Link key={c.id} to={`/m/content/${c.id}`} className="list-surface hover:bg-[rgba(163,24,40,0.05)]">
                <div className="text-sm font-medium text-[#0e1116]">{c.title}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-[rgba(14,17,22,0.55)]">
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
