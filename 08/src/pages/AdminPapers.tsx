import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  clearPaperDraft,
  loadPaperDraft,
  savePaperDraft,
  type PaperDraft,
} from '@/utils/paperDraft'
import {
  Plus,
  ArrowsClockwise,
  Trash,
  ArrowRight,
  Circle,
  CheckSquare,
  ListChecks,
} from '@phosphor-icons/react'

type Question = { id: string; type: string; category: string; stem: string }
type Paper = {
  id: string
  title: string
  durationMin: number
  passScore: number
  questions: { questionId: string; score: number; orderNo: number }[]
}

const PICK_ENTRIES = [
  { type: 'single', label: '单选题', icon: Circle, to: '/admin/papers/pick/single' },
  { type: 'tf', label: '判断题', icon: CheckSquare, to: '/admin/papers/pick/tf' },
  { type: 'multiple', label: '多选题', icon: ListChecks, to: '/admin/papers/pick/multiple' },
] as const

export default function AdminPapers() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [items, setItems] = useState<Paper[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<PaperDraft>(() => loadPaperDraft())

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])

  const picksByType = useMemo(() => {
    const map = { single: 0, tf: 0, multiple: 0 }
    for (const p of form.picks) {
      const t = qById.get(p.questionId)?.type
      if (t === 'single' || t === 'tf' || t === 'multiple') map[t] += 1
    }
    return map
  }, [form.picks, qById])

  function updateDraft(next: PaperDraft) {
    setForm(next)
    savePaperDraft(next)
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [p, q] = await Promise.all([
        apiFetch<Paper[]>('/api/papers'),
        apiFetch<Question[]>('/api/questions'),
      ])
      setItems(p)
      setQuestions(q)
      setForm(loadPaperDraft())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function create() {
    setError(null)
    try {
      const paperQuestions = form.picks.map((p, idx) => ({
        questionId: p.questionId,
        score: p.score,
        orderNo: idx + 1,
      }))
      await apiFetch<{ id: string }>('/api/papers', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          durationMin: form.durationMin,
          passScore: form.passScore,
          questions: paperQuestions,
        }),
      })
      clearPaperDraft()
      setForm(loadPaperDraft())
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建失败')
    }
  }

  async function remove(id: string) {
    if (!confirm('确认删除该试卷？若已被测验引用将无法删除。')) return
    setError(null)
    try {
      await apiFetch<void>(`/api/papers/${id}`, { method: 'DELETE' })
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  function removePick(questionId: string) {
    updateDraft({
      ...form,
      picks: form.picks.filter((p) => p.questionId !== questionId),
    })
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">管理后台</div>
          <h1 className="page-title text-3xl md:text-4xl">试卷管理</h1>
          <div className="page-subtitle mt-2 max-w-2xl">组卷（题目 + 分值 + 顺序）</div>
        </div>
        <Button variant="ghost" onClick={() => void load()} disabled={loading}>
          <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#9e1b2b]" />
              新建试卷
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="field-label">标题</span>
                <input
                  value={form.title}
                  onChange={(e) => updateDraft({ ...form, title: e.target.value })}
                  className="input-shell"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="field-label">时长（分钟）</span>
                  <input
                    type="number"
                    value={form.durationMin}
                    onChange={(e) =>
                      updateDraft({ ...form, durationMin: Number(e.target.value) })
                    }
                    className="input-shell"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="field-label">及格线</span>
                  <input
                    type="number"
                    value={form.passScore}
                    onChange={(e) =>
                      updateDraft({ ...form, passScore: Number(e.target.value) })
                    }
                    className="input-shell"
                  />
                </label>
              </div>

              <div className="text-xs text-zinc-500">按题型选择题目（进入独立页面点选添加）</div>
              <div className="grid gap-2">
                {PICK_ENTRIES.map((entry) => {
                  const Icon = entry.icon
                  const count = picksByType[entry.type as keyof typeof picksByType]
                  return (
                    <Link
                      key={entry.type}
                      to={entry.to}
                      className="group flex items-center justify-between gap-3 rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition hover:bg-[rgba(158,27,43,0.05)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="h-5 w-5 shrink-0 text-[#9e1b2b]" weight="duotone" />
                        <div>
                          <div className="text-sm font-medium text-[#12151c]">选择{entry.label}</div>
                          <div className="text-xs text-zinc-500">
                            {count > 0 ? `已选 ${count} 题` : '点击进入选题页'}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[rgba(18,21,28,0.35)] transition group-hover:translate-x-0.5 group-hover:text-[#9e1b2b]" />
                    </Link>
                  )
                })}
              </div>

              <div className="text-xs text-zinc-500">已选题目（可调整分值）</div>
              <div className="grid gap-2">
                {form.picks.map((p, idx) => {
                  const q = qById.get(p.questionId)
                  return (
                    <div
                      key={p.questionId}
                      className="rounded-lg bg-white/90 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-sm text-[#12151c]">
                          #{idx + 1}{' '}
                          {q ? `${q.category} · ${q.type}` : p.questionId}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            value={p.score}
                            onChange={(e) => {
                              const v = Number(e.target.value)
                              updateDraft({
                                ...form,
                                picks: form.picks.map((x) =>
                                  x.questionId === p.questionId ? { ...x, score: v } : x,
                                ),
                              })
                            }}
                            className="input-shell w-20 px-2 py-1"
                          />
                          <button
                            type="button"
                            onClick={() => removePick(p.questionId)}
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-[rgba(158,27,43,0.08)] hover:text-[#9e1b2b]"
                            aria-label="移除题目"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-zinc-500">
                        {q?.stem ?? p.questionId}
                      </div>
                    </div>
                  )
                })}
                {form.picks.length === 0 && (
                  <div className="text-sm text-zinc-400">还未选择题目，请从上方题型入口进入选题</div>
                )}
              </div>

              <Button onClick={() => void create()} disabled={form.picks.length === 0}>
                <Plus className="h-4 w-4" />
                创建试卷
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle>试卷列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {items.map((p) => {
                const totalScore = p.questions.reduce((sum, q) => sum + Number(q.score ?? 0), 0)
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                  >
                    <Link
                      to={`/admin/papers/${p.id}`}
                      className="group flex min-w-0 flex-1 items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[#12151c] group-hover:text-[#9e1b2b]">
                          {p.title}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {p.durationMin} 分钟 · 及格 {p.passScore} · {p.questions.length} 题 · 总分{' '}
                          {totalScore}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#9e1b2b]">
                        查看详情
                        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                    <Button
                      variant="danger"
                      className="shrink-0 px-3"
                      onClick={() => void remove(p.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
              {items.length === 0 && <div className="py-10 text-sm text-zinc-400">暂无试卷</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
