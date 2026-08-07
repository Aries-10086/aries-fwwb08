import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ArrowRight, MagnifyingGlass } from '@phosphor-icons/react'

type Content = { id: string; type: string; title: string; category: string }
type TaskContent = { id: string; title: string; type: string; isCompleted: boolean }
type Task = {
  id: string
  title: string
  dueAt: string | null
  contents?: TaskContent[]
  progressPercent?: number
  isCompleted?: boolean
}

export default function Home() {
  const { user } = useAuthStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [q, setQ] = useState('')
  const [rec, setRec] = useState<{
    items: Array<Content & { reason?: string }>
    coldStart?: boolean
    text?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load(search = '') {
    setError(null)
    try {
      const qParam = search.trim() ? `&q=${encodeURIComponent(search.trim())}` : ''
      const [t, c] = await Promise.all([
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<Content[]>(`/api/contents?isPublic=1${qParam}`),
      ])
      setTasks(t)
      setContents(c)
      if (!search.trim()) {
        const r = await apiFetch<{ items?: Array<Content & { reason?: string }>; coldStart?: boolean; text?: string }>(
          '/api/ai/recommend',
          {
            method: 'POST',
            body: JSON.stringify({ userId: user?.id }),
          },
        )
        setRec({ items: r.items ?? [], coldStart: r.coldStart, text: r.text })
      }
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const openTasks = useMemo(() => tasks.filter((t) => !t.isCompleted).slice(0, 5), [tasks])

  return (
    <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
      <header className="pt-2">
        <p className="text-xs font-medium text-seal">你好，{user?.name}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">今日学习</h1>
      </header>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void load(q)
        }}
      >
        <div className="m-input flex flex-1 items-center gap-2 !py-0">
          <MagnifyingGlass size={16} className="text-ink/35" />
          <input
            className="w-full bg-transparent py-3 text-sm outline-none"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索学习内容"
          />
        </div>
        <Button type="submit" className="shrink-0 px-3">
          搜索
        </Button>
      </form>

      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}

      <section className="mt-5">
        <h2 className="text-sm font-semibold text-ink">学习任务</h2>
        <div className="mt-2 grid gap-2">
          {openTasks.map((t) => {
            const next = t.contents?.find((c) => !c.isCompleted)
            return (
              <div key={t.id} className="m-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="mt-1 text-xs text-ink/45">
                      进度 {t.progressPercent ?? 0}%
                      {t.dueAt ? ` · 截止 ${new Date(t.dueAt).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                  {next && (
                    <Link to={`/content/${next.id}`}>
                      <Button className="!min-h-9 px-3 text-xs">继续</Button>
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
          {openTasks.length === 0 && <div className="py-6 text-center text-sm text-ink/40">暂无未完成任务</div>}
        </div>
      </section>

      {!q.trim() && (
        <div className="mt-4">
          <Link to="/chat">
            <Button variant="secondary" className="w-full">
              AI 助手
            </Button>
          </Link>
        </div>
      )}

      {!q.trim() && (rec?.items?.length ?? 0) > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-ink">为你推荐</h2>
          {rec?.coldStart && (
            <div className="mt-2 rounded-xl bg-seal/10 px-3 py-2 text-xs text-seal-deep">
              新用户默认推荐：公共/必学内容
            </div>
          )}
          <div className="mt-2 grid gap-2">
            {rec!.items.slice(0, 4).map((c) => (
              <Link key={c.id} to={`/content/${c.id}`} className="m-card flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="mt-1 text-xs text-ink/45">
                    {c.category}
                    {c.reason ? ` · ${c.reason}` : ''}
                  </div>
                </div>
                <ArrowRight className="text-seal" size={16} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink">{q.trim() ? '搜索结果' : '公共内容'}</h2>
        <div className="mt-2 grid gap-2">
          {contents.slice(0, 20).map((c) => (
            <Link key={c.id} to={`/content/${c.id}`} className="m-card flex items-center justify-between gap-3 p-4">
              <div>
                <div className="text-sm font-medium">{c.title}</div>
                <div className="mt-1 text-xs text-ink/45">
                  {c.category} · {c.type === 'video' ? '视频' : '文章'}
                </div>
              </div>
              <ArrowRight className="text-seal" size={16} />
            </Link>
          ))}
          {contents.length === 0 && <div className="py-8 text-center text-sm text-ink/40">暂无内容</div>}
        </div>
      </section>
    </div>
  )
}
