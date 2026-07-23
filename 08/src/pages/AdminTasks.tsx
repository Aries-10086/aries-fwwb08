import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ClipboardList, Pencil, Plus, RotateCw, Trash2 } from 'lucide-react'

type Org = { id: string; name: string; parentId: string | null }
type Content = { id: string; title: string; category: string; isPublic: boolean }
type Task = { id: string; orgUnitId: string; title: string; dueAt: string | null; contentIds: string[] }

function toDatetimeLocal(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(v: string) {
  if (!v.trim()) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export default function AdminTasks() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const isSecretary = user?.role === 'secretary'
  const [orgs, setOrgs] = useState<Org[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    orgUnitId: '',
    title: '学习任务（新建）',
    dueAt: '',
    contentIds: [] as string[],
  })

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin' && user.role !== 'secretary') nav('/m/home')
  }, [nav, user])

  const contentById = useMemo(() => new Map(contents.map((c) => [c.id, c])), [contents])
  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs])
  const branchOrgs = useMemo(() => orgs.filter((o) => o.parentId), [orgs])

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
      if (isSecretary && user?.orgUnitId) {
        setForm((p) => ({ ...p, orgUnitId: user.orgUnitId || p.orgUnitId }))
      } else if (!form.orgUnitId) {
        const first = o.find((x) => x.parentId)
        if (first) setForm((p) => ({ ...p, orgUnitId: first.id }))
      }
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function resetForm() {
    setEditingId(null)
    setForm({
      orgUnitId: isSecretary && user?.orgUnitId ? user.orgUnitId : branchOrgs[0]?.id ?? '',
      title: '学习任务（新建）',
      dueAt: '',
      contentIds: [],
    })
  }

  async function save() {
    setError(null)
    const payload = {
      orgUnitId: form.orgUnitId,
      title: form.title.trim(),
      dueAt: fromDatetimeLocal(form.dueAt),
      contentIds: form.contentIds,
    }
    try {
      if (editingId) {
        await apiFetch<void>(`/api/tasks/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        await apiFetch<{ id: string }>('/api/tasks', { method: 'POST', body: JSON.stringify(payload) })
      }
      resetForm()
      await load()
    } catch (e: any) {
      setError(e?.message ?? '保存失败')
    }
  }

  async function remove(id: string) {
    if (!confirm('确认删除该学习任务？')) return
    setError(null)
    try {
      await apiFetch<void>(`/api/tasks/${id}`, { method: 'DELETE' })
      if (editingId === id) resetForm()
      await load()
    } catch (e: any) {
      setError(e?.message ?? '删除失败')
    }
  }

  function startEdit(t: Task) {
    setEditingId(t.id)
    setForm({
      orgUnitId: t.orgUnitId,
      title: t.title,
      dueAt: toDatetimeLocal(t.dueAt),
      contentIds: [...t.contentIds],
    })
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">{isSecretary ? '支部端' : '管理后台'}</div>
          <h1 className="page-title text-3xl md:text-4xl">学习任务发布</h1>
          <div className="page-subtitle mt-2 max-w-2xl">
            {isSecretary ? '为本支部发布、编辑学习任务' : '按支部分发指定学习内容'}
          </div>
        </div>
        <Button variant="ghost" onClick={() => load()} disabled={loading}>
          <RotateCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020] shadow-[inset_0_0_0_1px_rgba(163,24,40,0.16)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingId ? <Pencil className="h-5 w-5 text-[#a31828]" /> : <Plus className="h-5 w-5 text-[#a31828]" />}
              {editingId ? '编辑任务' : '新建任务'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {!isSecretary && (
                <label className="grid gap-1 text-sm">
                  <span className="field-label">支部</span>
                  <select
                    value={form.orgUnitId}
                    onChange={(e) => setForm((p) => ({ ...p, orgUnitId: e.target.value }))}
                    className="input-shell"
                  >
                    {branchOrgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="grid gap-1 text-sm">
                <span className="field-label">任务标题</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="input-shell"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="field-label">截止时间</span>
                <input
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))}
                  className="input-shell"
                />
              </label>
              <div className="text-xs text-zinc-500">选择内容（可多选）</div>
              <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
                {contents.map((c) => {
                  const checked = form.contentIds.includes(c.id)
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg bg-white/90 px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] hover:bg-[rgba(163,24,40,0.05)] transition"
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
                        className="mt-1 accent-[#a31828]"
                      />
                      <div>
                        <div className="text-sm text-[#0e1116]">{c.title}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {c.category} · {c.isPublic ? '公共' : '非公共'}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => save()} disabled={!form.title.trim() || form.contentIds.length === 0}>
                  <ClipboardList className="h-4 w-4" />
                  {editingId ? '保存修改' : '发布任务'}
                </Button>
                {editingId && (
                  <Button variant="secondary" onClick={() => resetForm()}>
                    取消编辑
                  </Button>
                )}
              </div>
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
                  className="rounded-xl bg-white/90 p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#0e1116]">{t.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {orgById.get(t.orgUnitId)?.name ?? t.orgUnitId}
                        {t.dueAt ? ` · 截止 ${new Date(t.dueAt).toLocaleString()}` : ''}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" className="px-3" onClick={() => startEdit(t)}>
                        <Pencil className="h-4 w-4" />
                        编辑
                      </Button>
                      <Button variant="danger" className="px-3" onClick={() => remove(t.id)}>
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {t.contentIds.map((cid) => (
                      <div
                        key={cid}
                        className="rounded-lg bg-white px-4 py-3 text-sm text-[#0e1116] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
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
