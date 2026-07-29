import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ClipboardText,
  PencilSimple,
  Plus,
  ArrowsClockwise,
  Trash,
} from '@phosphor-icons/react'

type Org = { id: string; name: string; parentId: string | null }
type Content = { id: string; title: string; category: string; isPublic: boolean }
type Task = {
  id: string
  orgUnitId: string
  title: string
  dueAt: string | null
  contentIds: string[]
  contents?: Array<{ id: string; title: string; type: string; isCompleted: boolean }>
  branchMemberCount?: number | null
  branchCompletedMemberCount?: number | null
  branchCompletionRate?: number | null
}

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
  const isAdmin = user?.role === 'admin'
  const [orgs, setOrgs] = useState<Org[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!success) return
    const t = window.setTimeout(() => setSuccess(null), 3500)
    return () => window.clearTimeout(t)
  }, [success])

  const contentById = useMemo(() => new Map(contents.map((c) => [c.id, c])), [contents])
  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs])
  const branchOrgs = useMemo(() => orgs.filter((o) => o.parentId), [orgs])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const contentsUrl = isSecretary ? '/api/contents?forTask=1' : '/api/contents'
      const [o, c, t] = await Promise.all([
        apiFetch<Org[]>('/api/org-units'),
        apiFetch<any[]>(contentsUrl),
        apiFetch<Task[]>('/api/tasks'),
      ])
      setOrgs(o)
      setContents(
        c.map((x) => ({ id: x.id, title: x.title, category: x.category, isPublic: x.isPublic })) as Content[],
      )
      setTasks(t)
      const ownBranch =
        isSecretary && user?.orgUnitId
          ? o.find((x) => x.id === user.orgUnitId)
          : o.find((x) => x.parentId)
      setForm((p) => ({
        ...p,
        orgUnitId: p.orgUnitId || ownBranch?.id || o.find((x) => x.parentId)?.id || '',
      }))
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'secretary')) load()
  }, [user?.id, user?.role])

  function resetForm() {
    setEditingId(null)
    const defaultOrg =
      (isSecretary && user?.orgUnitId) ||
      branchOrgs[0]?.id ||
      ''
    setForm({
      orgUnitId: defaultOrg,
      title: '学习任务（新建）',
      dueAt: '',
      contentIds: [],
    })
  }

  async function save() {
    setError(null)
    setSuccess(null)
    const payload = {
      orgUnitId: isSecretary ? user?.orgUnitId || form.orgUnitId : form.orgUnitId,
      title: form.title.trim(),
      dueAt: fromDatetimeLocal(form.dueAt),
      contentIds: form.contentIds,
    }
    try {
      if (editingId) {
        await apiFetch<void>(`/api/tasks/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) })
        setSuccess(`任务「${payload.title}」已更新`)
      } else {
        await apiFetch<{ id: string }>('/api/tasks', { method: 'POST', body: JSON.stringify(payload) })
        setSuccess(`任务「${payload.title}」已发布`)
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
    setSuccess(null)
    const title = tasks.find((x) => x.id === id)?.title ?? '任务'
    try {
      await apiFetch<void>(`/api/tasks/${id}`, { method: 'DELETE' })
      if (editingId === id) resetForm()
      await load()
      setSuccess(`「${title}」已删除`)
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
          <div className="page-eyebrow">{isSecretary ? '支部管理' : '管理后台'}</div>
          <h1 className="page-title text-3xl md:text-4xl">学习任务发布</h1>
          <div className="page-subtitle mt-2 max-w-2xl">
            {isSecretary
              ? '为本支部党员选择学习内容、设置截止时间并发布任务'
              : '按支部分发指定学习内容'}
          </div>
        </div>
        <Button variant="ghost" onClick={() => load()} disabled={loading}>
          <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-2xl bg-[rgba(31,107,74,0.1)] px-4 py-3 text-sm font-medium text-[#1f6b4a] shadow-[inset_0_0_0_1px_rgba(31,107,74,0.18)]"
        >
          {success}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingId ? <PencilSimple className="h-5 w-5 text-[#9e1b2b]" /> : <Plus className="h-5 w-5 text-[#9e1b2b]" />}
              {editingId ? '编辑任务' : '新建任务'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="field-label">支部</span>
                <select
                  value={form.orgUnitId}
                  onChange={(e) => setForm((p) => ({ ...p, orgUnitId: e.target.value }))}
                  className="input-shell"
                  disabled={isSecretary}
                >
                  {branchOrgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                {isSecretary && (
                  <div className="mt-1 text-[11px] text-[rgba(18,21,28,0.45)]">书记仅可向本支部发布任务</div>
                )}
              </label>
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
                <div className="mt-1 text-[11px] text-[rgba(18,21,28,0.45)]">
                  设置后，党员端将在截止前 24 小时收到页内提醒；开启浏览器通知后还可系统推送
                </div>
              </label>
              <div className="text-xs text-zinc-500">选择内容（可多选）</div>
              <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
                {contents.map((c) => {
                  const checked = form.contentIds.includes(c.id)
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg bg-white/90 px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] hover:bg-[rgba(158,27,43,0.05)] transition"
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
                        className="mt-1 accent-[#9e1b2b]"
                      />
                      <div>
                        <div className="text-sm text-[#12151c]">{c.title}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {c.category} · {c.isPublic ? '公共' : '非公共'}
                        </div>
                      </div>
                    </label>
                  )
                })}
                {contents.length === 0 && <div className="py-6 text-sm text-zinc-400">暂无可选内容</div>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void save()} disabled={!form.title.trim() || form.contentIds.length === 0}>
                  <ClipboardText className="h-4 w-4" />
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
              {tasks.map((t) => {
                const branchRate = t.branchCompletionRate ?? 0
                const branchDone = t.branchCompletedMemberCount ?? 0
                const branchTotal = t.branchMemberCount ?? 0
                const open = expandedId === t.id
                return (
                <div
                  key={t.id}
                  className="rounded-xl bg-white/90 p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#12151c]">{t.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {orgById.get(t.orgUnitId)?.name ?? t.orgUnitId}
                        {t.dueAt ? ` · 截止 ${new Date(t.dueAt).toLocaleString()}` : ''}
                        {branchTotal > 0
                          ? ` · 支部完成 ${branchDone}/${branchTotal}（${branchRate}%）`
                          : ''}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(isAdmin || isSecretary) && branchTotal > 0 && (
                        <Button
                          variant="ghost"
                          className="px-3"
                          onClick={() => setExpandedId(open ? null : t.id)}
                        >
                          {open ? '收起进度' : '完成进度'}
                        </Button>
                      )}
                      <Button variant="secondary" className="px-3" onClick={() => startEdit(t)}>
                        <PencilSimple className="h-4 w-4" />
                        编辑
                      </Button>
                      <Button variant="danger" className="px-3" onClick={() => void remove(t.id)}>
                        <Trash className="h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                  {branchTotal > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px] text-[rgba(18,21,28,0.45)]">
                        <span>支部完成进度</span>
                        <span className="font-medium text-[#9e1b2b]">{branchRate}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[rgba(18,21,28,0.06)]">
                        <div
                          className="h-full rounded-full bg-[#9e1b2b] transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, branchRate))}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {open && (
                    <div className="mt-3 rounded-lg bg-[rgba(18,21,28,0.03)] px-3 py-3 text-xs text-[rgba(18,21,28,0.7)]">
                      已完成 {branchDone} 人 · 未完成 {Math.max(0, branchTotal - branchDone)} 人。可到「支部看板」查看未完成名单。
                    </div>
                  )}
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {(t.contents?.length
                      ? t.contents.map((c) => ({ id: c.id, title: c.title }))
                      : t.contentIds.map((cid) => ({
                          id: cid,
                          title: contentById.get(cid)?.title ?? cid,
                        }))
                    ).map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg bg-white px-4 py-3 text-sm text-[#12151c] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                      >
                        {c.title}
                      </div>
                    ))}
                  </div>
                </div>
                )
              })}
              {tasks.length === 0 && <div className="py-10 text-sm text-zinc-400">暂无任务</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
