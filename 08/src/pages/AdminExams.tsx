import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ClipboardList, Plus, RotateCw } from 'lucide-react'

type Org = { id: string; name: string; parentId: string | null }
type Paper = { id: string; title: string; durationMin: number; passScore: number }
type Exam = {
  id: string
  orgUnitId: string
  paperId: string
  title: string
  durationMin: number
  passScore: number
  status: 'draft' | 'published' | 'closed'
  createdAt: string
}

export default function AdminExams() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [papers, setPapers] = useState<Paper[]>([])
  const [items, setItems] = useState<Exam[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    orgUnitId: 'org_branch_3',
    paperId: 'paper_1',
    title: '测验（新建）',
    durationMin: 10,
    passScore: 60,
    status: 'published' as Exam['status'],
  })

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs])
  const paperById = useMemo(() => new Map(papers.map((p) => [p.id, p.title])), [papers])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [o, p, e] = await Promise.all([
        apiFetch<Org[]>('/api/org-units'),
        apiFetch<any[]>('/api/papers'),
        apiFetch<Exam[]>('/api/exams'),
      ])
      setOrgs(o)
      setPapers(p.map((x) => ({ id: x.id, title: x.title, durationMin: x.durationMin, passScore: x.passScore })))
      setItems(e)
    } catch (err: any) {
      setError(err?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const paper = papers.find((p) => p.id === form.paperId)
    if (!paper) return
    setForm((prev) => ({
      ...prev,
      durationMin: paper.durationMin,
      passScore: paper.passScore,
      title: `${orgById.get(prev.orgUnitId) ?? '支部'}：${paper.title}`,
    }))
  }, [form.paperId, orgById, papers])

  async function create() {
    setError(null)
    try {
      await apiFetch<{ id: string }>('/api/exams', { method: 'POST', body: JSON.stringify(form) })
      await load()
    } catch (e: any) {
      setError(e?.message ?? '创建失败')
    }
  }

  async function updateStatus(exam: Exam, status: Exam['status']) {
    setError(null)
    try {
      await apiFetch<void>(`/api/exams/${exam.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...exam, status }),
      })
      await load()
    } catch (e: any) {
      setError(e?.message ?? '更新失败')
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-400">管理后台</div>
          <h1 className="mt-2 text-2xl font-[850] tracking-[-0.05em] text-zinc-50">测验发布</h1>
          <div className="mt-2 text-sm text-zinc-300/90">基于试卷发布测验并指定支部对象</div>
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
              新建测验
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
                <span className="text-xs text-zinc-400">试卷</span>
                <select
                  value={form.paperId}
                  onChange={(e) => setForm((p) => ({ ...p, paperId: e.target.value }))}
                  className="rounded-lg bg-black/30 px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none"
                >
                  {papers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs text-zinc-400">标题</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="rounded-lg bg-black/30 px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none"
                />
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1 text-sm">
                  <span className="text-xs text-zinc-400">时长</span>
                  <input
                    type="number"
                    value={form.durationMin}
                    onChange={(e) => setForm((p) => ({ ...p, durationMin: Number(e.target.value) }))}
                    className="rounded-lg bg-black/30 px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs text-zinc-400">及格线</span>
                  <input
                    type="number"
                    value={form.passScore}
                    onChange={(e) => setForm((p) => ({ ...p, passScore: Number(e.target.value) }))}
                    className="rounded-lg bg-black/30 px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs text-zinc-400">状态</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as any }))}
                    className="rounded-lg bg-black/30 px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none"
                  >
                    <option value="draft">草稿</option>
                    <option value="published">已发布</option>
                    <option value="closed">已关闭</option>
                  </select>
                </label>
              </div>
              <Button onClick={() => create()} disabled={!form.title.trim() || !form.paperId || !form.orgUnitId}>
                <ClipboardList className="h-4 w-4" />
                创建并发布
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle>测验列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {items.map((e) => (
                <div
                  key={e.id}
                  className="rounded-xl bg-white/5 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-zinc-100">{e.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {orgById.get(e.orgUnitId) ?? e.orgUnitId} · {paperById.get(e.paperId) ?? e.paperId}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
                        {e.status}
                      </span>
                      <Button variant="secondary" className="px-3" onClick={() => updateStatus(e, 'published')}>
                        发布
                      </Button>
                      <Button variant="danger" className="px-3" onClick={() => updateStatus(e, 'closed')}>
                        关闭
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">{e.durationMin} 分钟 · 及格 {e.passScore} 分</div>
                </div>
              ))}
              {items.length === 0 && <div className="py-10 text-sm text-zinc-400">暂无测验</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

