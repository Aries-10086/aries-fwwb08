import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ArrowRight, BookOpen, ClipboardList, Sparkles } from 'lucide-react'

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

export default function MobileHome() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [rec, setRec] = useState<{ text: string; items: Content[]; weakCategories: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role === 'admin') nav('/admin/dashboard')
  }, [nav, user])

  async function load() {
    setError(null)
    try {
      const [t, c] = await Promise.all([
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<Content[]>('/api/contents?isPublic=1'),
      ])
      setTasks(t)
      setContents(c)
      const r = await apiFetch<any>('/api/ai/recommend', { method: 'POST', body: JSON.stringify({ userId: user?.id }) })
      setRec(r)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const publicTop = useMemo(() => contents.slice(0, 6), [contents])

  return (
    <div className="grid gap-6">
      <div className="hero-frame px-6 py-7 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="page-eyebrow">党员学习</div>
            <h1 className="page-title text-3xl md:text-4xl">学习首页</h1>
            <div className="page-subtitle mt-2 max-w-2xl">
              组织要求、公共内容与 AI 建议汇聚于此，帮助完成当期学习任务。
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
            ['公共内容', `${contents.length} 项可浏览`],
            ['AI 推荐', rec ? `${rec.items.length} 条建议` : '生成中'],
          ].map(([label, value]) => (
            <div key={label} className="panel-muted px-4 py-4">
              <div className="text-[11px] tracking-[0.2em] text-[#a31828]">{label}</div>
              <div className="mt-3 font-serif text-2xl font-bold tracking-wide text-[#0e1116]">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="border border-[rgba(163,24,40,0.2)] bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020]">
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
              {tasks.map((t) => (
                <div key={t.id} className="list-surface">
                  <div className="text-sm font-medium text-[#0e1116]">{t.title}</div>
                  <div className="mt-1 text-xs text-[rgba(14,17,22,0.55)]">内容数：{t.contentIds.length}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.contentIds.slice(0, 3).map((cid) => (
                      <Link key={cid} to={`/m/content/${cid}`}>
                        <Button variant="secondary" className="px-3 py-1.5 text-xs">
                          打开内容
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {tasks.length === 0 && <div className="py-8 text-sm text-[rgba(14,17,22,0.4)]">暂无学习任务</div>}
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
                <div className="list-surface text-sm leading-relaxed text-[rgba(14,17,22,0.72)]">
                  {rec.text}
                </div>
                <div className="grid gap-2">
                  {rec.items.slice(0, 5).map((c) => (
                    <Link
                      key={c.id}
                      to={`/m/content/${c.id}`}
                      className="list-surface flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium text-[#0e1116]">{c.title}</div>
                        <div className="mt-1 text-xs text-[rgba(14,17,22,0.55)]">{c.category}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[rgba(14,17,22,0.35)]" />
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-sm text-[rgba(14,17,22,0.4)]">正在生成推荐…</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>公共内容</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {publicTop.map((c) => (
              <Link key={c.id} to={`/m/content/${c.id}`} className="list-surface">
                <div className="text-sm font-medium text-[#0e1116]">{c.title}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-[rgba(14,17,22,0.55)]">
                  <span>{c.category}</span>
                  <span>{c.type === 'video' ? '视频' : '文章'}</span>
                </div>
              </Link>
            ))}
            {publicTop.length === 0 && <div className="py-10 text-sm text-[rgba(14,17,22,0.4)]">暂无公共内容</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
