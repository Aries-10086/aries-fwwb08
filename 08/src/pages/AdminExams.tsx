import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { SuccessToast, useSuccessToast } from '@/components/SuccessToast'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ClipboardText,
  Plus,
  ArrowsClockwise,
  Trash,
} from '@phosphor-icons/react'

type Org = { id: string; name: string; parentId: string | null }
type Paper = { id: string; title: string; durationMin: number; passScore: number }
type Exam = {
  id: string
  orgUnitId: string
  paperId: string
  title: string
  durationMin: number
  passScore: number
  maxAttempts?: number
  type?: 'quiz' | 'formal'
  openNotice?: string
  status: 'draft' | 'published' | 'closed'
  createdAt: string
}

const statusLabel: Record<Exam['status'], string> = {
  draft: '草稿',
  published: '已发布',
  closed: '已关闭',
}

const typeLabel = { quiz: '测验', formal: '正式考试' } as const

export default function AdminExams() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [papers, setPapers] = useState<Paper[]>([])
  const [items, setItems] = useState<Exam[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { message: success, showSuccess } = useSuccessToast()

  const [form, setForm] = useState({
    orgUnitId: 'org_branch_3',
    paperId: 'paper_1',
    title: '测验（新建）',
    durationMin: 10,
    passScore: 60,
    maxAttempts: 3,
    type: 'quiz' as 'quiz' | 'formal',
    openNotice: '',
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
    showSuccess(null)
    setSavingId('create')
    try {
      await apiFetch<{ id: string }>('/api/exams', { method: 'POST', body: JSON.stringify(form) })
      await load()
      const branch = orgById.get(form.orgUnitId) ?? '目标支部'
      showSuccess(
        form.status === 'published'
          ? `测验「${form.title}」已创建并发布至「${branch}」`
          : `测验「${form.title}」已创建（状态：${statusLabel[form.status]}）`,
      )
    } catch (e: any) {
      setError(e?.message ?? '创建失败')
    } finally {
      setSavingId(null)
    }
  }

  async function updateStatus(exam: Exam, status: Exam['status']) {
    setError(null)
    showSuccess(null)
    setSavingId(exam.id)
    try {
      await apiFetch<void>(`/api/exams/${exam.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...exam, status }),
      })
      await load()
      if (status === 'published') {
        showSuccess(`「${exam.title}」发布成功，支部党员现可作答`)
      } else if (status === 'closed') {
        showSuccess(`「${exam.title}」已关闭，党员端将不可再进入`)
      } else {
        showSuccess(`「${exam.title}」状态已更新为${statusLabel[status]}`)
      }
    } catch (e: any) {
      setError(e?.message ?? '更新失败')
    } finally {
      setSavingId(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('确认删除该测验及其作答记录？')) return
    setError(null)
    showSuccess(null)
    const title = items.find((x) => x.id === id)?.title ?? '测验'
    setSavingId(id)
    try {
      await apiFetch<void>(`/api/exams/${id}`, { method: 'DELETE' })
      await load()
      showSuccess(`「${title}」已删除`)
    } catch (e: any) {
      setError(e?.message ?? '删除失败')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">管理后台</div>
          <h1 className="page-title text-3xl md:text-4xl">测验发布</h1>
        </div>
        <Button variant="ghost" onClick={() => load()} disabled={loading}>
          <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
          {error}
        </div>
      )}
      <SuccessToast message={success} />

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#9e1b2b]" />
              新建测验
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
                <span className="field-label">试卷</span>
                <select
                  value={form.paperId}
                  onChange={(e) => setForm((p) => ({ ...p, paperId: e.target.value }))}
                  className="input-shell"
                >
                  {papers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="field-label">标题</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="input-shell"
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="field-label">时长（分钟）</span>
                  <input
                    type="number"
                    value={form.durationMin}
                    onChange={(e) => setForm((p) => ({ ...p, durationMin: Number(e.target.value) }))}
                    className="input-shell"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="field-label">及格线</span>
                  <input
                    type="number"
                    value={form.passScore}
                    onChange={(e) => setForm((p) => ({ ...p, passScore: Number(e.target.value) }))}
                    className="input-shell"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="field-label">类型</span>
                  <select
                    value={form.type}
                    onChange={(e) => {
                      const type = e.target.value as 'quiz' | 'formal'
                      setForm((p) => ({
                        ...p,
                        type,
                        maxAttempts: type === 'formal' ? 1 : p.maxAttempts < 2 ? 3 : p.maxAttempts,
                        openNotice:
                          type === 'formal' && !p.openNotice
                            ? '正式考试须独立完成，开考后不可中途离开；到时将强制交卷。请确认已阅读说明。'
                            : p.openNotice,
                      }))
                    }}
                    className="input-shell"
                  >
                    <option value="quiz">日常测验</option>
                    <option value="formal">正式考试</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="field-label">最大作答次数</span>
                  <input
                    type="number"
                    min={1}
                    value={form.maxAttempts}
                    onChange={(e) => setForm((p) => ({ ...p, maxAttempts: Number(e.target.value) }))}
                    className="input-shell"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="field-label">状态</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as any }))}
                    className="input-shell"
                  >
                    <option value="draft">草稿</option>
                    <option value="published">已发布</option>
                    <option value="closed">已关闭</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="field-label">开考说明（正式考试建议填写）</span>
                <textarea
                  value={form.openNotice}
                  onChange={(e) => setForm((p) => ({ ...p, openNotice: e.target.value }))}
                  className="input-shell min-h-[72px]"
                  placeholder="开考前党员须勾选确认的说明文案"
                />
              </label>
              <Button
                onClick={() => void create()}
                disabled={!form.title.trim() || !form.paperId || !form.orgUnitId || savingId === 'create'}
              >
                <ClipboardText className="h-4 w-4" />
                {savingId === 'create' ? '发布中…' : '创建并发布'}
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
                  className="rounded-xl bg-white/90 p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#12151c]">{e.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {orgById.get(e.orgUnitId) ?? e.orgUnitId} · {paperById.get(e.paperId) ?? e.paperId}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-[rgba(18,21,28,0.7)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                        {typeLabel[e.type ?? 'quiz']}
                      </span>
                      <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-[rgba(18,21,28,0.7)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                        {statusLabel[e.status]}
                      </span>
                      <Button
                        variant="secondary"
                        className="px-3"
                        disabled={savingId === e.id || e.status === 'published'}
                        onClick={() => void updateStatus(e, 'published')}
                      >
                        {savingId === e.id ? '…' : e.status === 'published' ? '已发布' : '发布'}
                      </Button>
                      <Button
                        variant="secondary"
                        className="px-3"
                        disabled={savingId === e.id || e.status === 'closed'}
                        onClick={() => void updateStatus(e, 'closed')}
                      >
                        关闭
                      </Button>
                      <Button
                        variant="danger"
                        className="px-3"
                        disabled={savingId === e.id}
                        onClick={() => void remove(e.id)}
                      >
                        <Trash className="h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">
                    {e.durationMin} 分钟 · 及格 {e.passScore} 分 · 最多 {e.maxAttempts ?? 3} 次
                  </div>
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
