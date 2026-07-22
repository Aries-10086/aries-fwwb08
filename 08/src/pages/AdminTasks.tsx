import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ClipboardList, Plus, RotateCw } from 'lucide-react'

type Org = { id: string; name: string; parentId: string | null }
type Content = { id: string; title: string; category: string; isPublic: boolean }
type Task = { id: string; orgUnitId: string; title: string; dueAt: string | null; contentIds: string[] }

export default function AdminTasks() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    orgUnitId: 'org_branch_3',
    title: '学习任务（新建）',
    contentIds: [] as string[],
  })

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  const contentById = useMemo(() => new Map(contents.map((c) => [c.id, c])), [contents])
  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [o, c, t] = await Promise.all([
        apiFetch<Org[]>('/api/org-units'),
        apiFetch<any[]>('/api/contents'),
        apiFetch<Task[]>('/api/tasks'),
      ])
      setOrgs(o)
      setContents(
        c.map((x) => ({ id: x.id, title: x.title, category: x.category, isPublic: x.isPublic })) as Content[],
      )
      setTasks(t)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function create() {
    setError(null)
    try {
      await apiFetch<{ id: string }>('/api/tasks', { method: 'POST', body: JSON.stringify(form) })
      setForm((p) => ({ ...p, title: '学习任务（新建）', contentIds: [] }))
      await load()
    } catch (e: any) {
      setError(e?.message ?? '创建失败')
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-400">管理后台</div>
          <h1 className="mt-2 text-2xl font-[850] tracking-[-0.05em] text-zinc-50">学习任务发布</h1>
          <div className="mt-2 text-sm text-zinc-300/90">按支部分发指定学习内容</div>
        </div>
        <Button variant="ghost" onClick={() => load()} disabled={loading}>
          <RotateCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-500/10 px-4 py-3 text-rose-200 shadow-[0_0_0_1px_rgba(244,63,94,0.25)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-200/90" />
              新建任务
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-xs text-zinc-400">支部</span>
                <select
                  value={form.orgUnitId}
                  onChange={(e) => setForm((p) => ({ ...p, orgUnitId: e.target.value }))}
                  className="rounded-lg bg-black/30 px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none"
                >
                  {orgs
                    .filter((o) => o.parentId)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs text-zinc-400">任务标题</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="rounded-lg bg-black/30 px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none"
                />
              </label>
              <div className="text-xs text-zinc-500">选择内容（可多选）</div>
              <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
                {contents.map((c) => {
                  const checked = form.contentIds.includes(c.id)
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] hover:bg-white/10 transition"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setForm((p) => ({
                            ...p,
                            contentIds: checked ? p.contentIds.filter((x) => x !== c.id) : [...p.contentIds, c.id],
                          }))
                        }}
                        className="mt-1 accent-amber-300"
                      />
                      <div>
                        <div className="text-sm text-zinc-200">{c.title}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {c.category} · {c.isPublic ? '公共' : '非公共'}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
              <Button onClick={() => create()} disabled={!form.title.trim() || form.contentIds.length === 0}>
                <ClipboardList className="h-4 w-4" />
                发布任务
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle>任务列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl bg-white/5 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-100">{t.title}</div>
                    <div className="text-xs text-zinc-500">{orgById.get(t.orgUnitId)?.name ?? t.orgUnitId}</div>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {t.contentIds.map((cid) => (
                      <div
                        key={cid}
                        className="rounded-lg bg-black/30 px-4 py-3 text-sm text-zinc-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]"
                      >
                        {contentById.get(cid)?.title ?? cid}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {tasks.length === 0 && <div className="py-10 text-sm text-zinc-400">暂无任务</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

