import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'

type Content = { id: string; title: string; category: string }
type Task = {
  id: string
  title: string
  dueAt: string | null
  contentIds: string[]
  branchCompletionRate?: number | null
}

export default function Tasks() {
  const { user } = useAuthStore()
  const nav = useNavigate()
  const [contents, setContents] = useState<Content[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '移动端学习任务',
    dueAt: '',
    contentIds: [] as string[],
  })

  useEffect(() => {
    if (user && user.role !== 'secretary' && user.role !== 'admin') nav('/home', { replace: true })
  }, [user, nav])

  async function load() {
    setError(null)
    try {
      const [c, t] = await Promise.all([
        apiFetch<Content[]>('/api/contents?forTask=1'),
        apiFetch<Task[]>('/api/tasks'),
      ])
      setContents(c.map((x) => ({ id: x.id, title: x.title, category: x.category })))
      setTasks(t)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const selectedSet = useMemo(() => new Set(form.contentIds), [form.contentIds])

  async function publish() {
    if (!form.title.trim() || form.contentIds.length === 0) {
      setError('请填写标题并至少选择 1 个内容')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          orgUnitId: user?.orgUnitId,
          title: form.title.trim(),
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
          contentIds: form.contentIds,
        }),
      })
      setSuccess('任务已发布')
      setForm({ title: '移动端学习任务', dueAt: '', contentIds: [] })
      await load()
    } catch (e: any) {
      setError(e?.message ?? '发布失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 pb-4 pt-[max(1rem,var(--safe-top))]">
      <h1 className="pt-2 text-2xl font-bold">任务发布</h1>
      <p className="mt-1 text-sm text-ink/50">向本支部派发学习任务</p>
      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}
      {success && <div className="mt-3 rounded-xl bg-[#1f6b4a]/10 px-3 py-2 text-sm text-[#1f6b4a]">{success}</div>}

      <div className="m-card mt-4 grid gap-3 p-4">
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-ink/45">标题</span>
          <input
            className="m-input"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-ink/45">截止（可选）</span>
          <input
            type="datetime-local"
            className="m-input"
            value={form.dueAt}
            onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))}
          />
        </label>
        <div className="text-xs text-ink/45">选择内容（已选 {form.contentIds.length}）</div>
        <div className="max-h-48 overflow-y-auto grid gap-1">
          {contents.map((c) => (
            <label key={c.id} className="flex items-start gap-2 rounded-lg bg-paper px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 accent-[var(--seal)]"
                checked={selectedSet.has(c.id)}
                onChange={() => {
                  setForm((p) => ({
                    ...p,
                    contentIds: selectedSet.has(c.id)
                      ? p.contentIds.filter((id) => id !== c.id)
                      : [...p.contentIds, c.id],
                  }))
                }}
              />
              <span>
                <span className="font-medium">{c.title}</span>
                <span className="mt-0.5 block text-[11px] text-ink/40">{c.category}</span>
              </span>
            </label>
          ))}
        </div>
        <Button disabled={saving} onClick={() => void publish()}>
          {saving ? '发布中…' : '发布任务'}
        </Button>
      </div>

      <h2 className="mt-6 text-sm font-semibold">已发布</h2>
      <div className="mt-2 grid gap-2">
        {tasks.map((t) => (
          <div key={t.id} className="m-card p-3">
            <div className="text-sm font-medium">{t.title}</div>
            <div className="mt-1 text-xs text-ink/45">
              {t.contentIds.length} 个内容
              {t.dueAt ? ` · 截止 ${new Date(t.dueAt).toLocaleString()}` : ''}
              {t.branchCompletionRate != null ? ` · 完成率 ${t.branchCompletionRate}%` : ''}
            </div>
          </div>
        ))}
        {tasks.length === 0 && <div className="py-8 text-center text-sm text-ink/40">暂无任务</div>}
      </div>
    </div>
  )
}
