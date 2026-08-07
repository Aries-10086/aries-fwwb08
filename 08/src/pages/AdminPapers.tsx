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
  const [quickType, setQuickType] = useState<'single' | 'tf' | 'multiple' | 'any'>('single')
  const [quickCategory, setQuickCategory] = useState('')
  const [quickCount, setQuickCount] = useState(5)
  const [ruleText, setRuleText] = useState('党史 5；党章 3；判断 2')
  const [quotaRows, setQuotaRows] = useState<Array<{ category: string; type: string; count: number }>>([
    { category: '', type: 'any', count: 5 },
  ])

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])
  const categories = useMemo(
    () => [...new Set(questions.map((q) => q.category).filter(Boolean))].sort(),
    [questions],
  )
  const totalScore = useMemo(
    () => form.picks.reduce((s, p) => s + Number(p.score || 0), 0),
    [form.picks],
  )

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

  function quickDraw() {
    const picked = new Set(form.picks.map((p) => p.questionId))
    const pool = questions.filter((q) => {
      if (picked.has(q.id)) return false
      if (quickType !== 'any' && q.type !== quickType) return false
      if (quickCategory && q.category !== quickCategory) return false
      return true
    })
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const take = shuffled.slice(0, Math.max(1, quickCount))
    if (take.length === 0) {
      setError('该条件下没有可抽题目')
      return
    }
    const scoreEach = Math.max(1, Math.round(100 / Math.max(1, form.picks.length + take.length)))
    updateDraft({
      ...form,
      picks: [
        ...form.picks,
        ...take.map((q) => ({ questionId: q.id, score: scoreEach })),
      ],
    })
    setError(null)
  }

  /** 按多分类/题型配额抽题（规则组卷） */
  function composeByQuotas(rows: Array<{ category: string; type: string; count: number }>) {
    const picked = new Set(form.picks.map((p) => p.questionId))
    const added: Array<{ questionId: string; score: number }> = []
    const missing: string[] = []
    for (const row of rows) {
      const need = Math.max(0, Math.floor(Number(row.count) || 0))
      if (need <= 0) continue
      const pool = questions.filter((q) => {
        if (picked.has(q.id)) return false
        if (row.type && row.type !== 'any' && q.type !== row.type) return false
        if (row.category && q.category !== row.category) return false
        return true
      })
      const take = [...pool].sort(() => Math.random() - 0.5).slice(0, need)
      for (const q of take) {
        picked.add(q.id)
        added.push({ questionId: q.id, score: 5 })
      }
      if (take.length < need) {
        missing.push(
          `${row.category || '不限分类'}/${row.type === 'any' || !row.type ? '不限题型' : row.type} 缺 ${need - take.length}`,
        )
      }
    }
    if (added.length === 0) {
      setError('配额条件下没有可抽题目')
      return
    }
    const total = form.picks.length + added.length
    const scoreEach = Math.max(1, Math.round(100 / Math.max(1, total)))
    updateDraft({
      ...form,
      picks: [
        ...form.picks,
        ...added.map((a) => ({ ...a, score: scoreEach })),
      ],
    })
    setError(missing.length ? `已抽 ${added.length} 题；不足：${missing.join('；')}` : null)
  }

  /** 解析自然语言配额，如「党史5题 党章3 判断2」 */
  function parseRuleText(text: string) {
    const cats = categories.length ? categories : ['党史', '党章', '理论']
    const rows: Array<{ category: string; type: string; count: number }> = []
    const parts = text.split(/[；;，,\s]+/).filter(Boolean)
    for (const part of parts) {
      const m = part.match(/^(.+?)(\d+)\s*题?$/) || part.match(/^(\d+)\s*(.+)$/)
      if (!m) continue
      let label = ''
      let count = 0
      if (/^\d/.test(part)) {
        count = Number(m[1])
        label = m[2]
      } else {
        label = m[1]
        count = Number(m[2])
      }
      label = label.replace(/题$/, '').trim()
      if (!count) continue
      if (/判断/.test(label)) {
        rows.push({ category: '', type: 'tf', count })
        continue
      }
      if (/单选/.test(label)) {
        rows.push({ category: '', type: 'single', count })
        continue
      }
      if (/多选/.test(label)) {
        rows.push({ category: '', type: 'multiple', count })
        continue
      }
      const cat = cats.find((c) => label.includes(c) || c.includes(label)) || label
      rows.push({ category: cat, type: 'any', count })
    }
    return rows
  }

  function applyRuleText() {
    const rows = parseRuleText(ruleText)
    if (rows.length === 0) {
      setError('无法解析规则，试试：党史 5；党章 3；判断 2')
      return
    }
    setQuotaRows(rows)
    composeByQuotas(rows)
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">管理后台</div>
          <h1 className="page-title text-3xl md:text-4xl">试卷管理</h1>
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

              <div className="rounded-xl bg-[rgba(158,27,43,0.04)] px-3 py-3 shadow-[inset_0_0_0_1px_rgba(158,27,43,0.1)]">
                <div className="text-xs font-medium text-[#741220]">一键抽题</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <select
                    className="input-shell text-xs"
                    value={quickType}
                    onChange={(e) => setQuickType(e.target.value as typeof quickType)}
                  >
                    <option value="single">单选</option>
                    <option value="tf">判断</option>
                    <option value="multiple">多选</option>
                    <option value="any">不限题型</option>
                  </select>
                  <select
                    className="input-shell text-xs"
                    value={quickCategory}
                    onChange={(e) => setQuickCategory(e.target.value)}
                  >
                    <option value="">全部分类</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="input-shell text-xs"
                    value={quickCount}
                    onChange={(e) => setQuickCount(Number(e.target.value) || 1)}
                    title="抽题数量"
                  />
                </div>
                <Button variant="secondary" className="mt-2 w-full" onClick={quickDraw}>
                  随机抽取 {quickCount} 题
                </Button>
              </div>

              <div className="rounded-xl bg-[rgba(31,107,74,0.05)] px-3 py-3 shadow-[inset_0_0_0_1px_rgba(31,107,74,0.12)]">
                <div className="text-xs font-medium text-[#1f6b4a]">规则组卷（按分类/题型配额）</div>
                <input
                  className="input-shell mt-2 text-xs"
                  value={ruleText}
                  onChange={(e) => setRuleText(e.target.value)}
                  placeholder="党史 5；党章 3；判断 2"
                />
                <Button variant="secondary" className="mt-2 w-full" onClick={applyRuleText}>
                  按自然语言规则抽题
                </Button>
                <div className="mt-3 grid gap-2">
                  {quotaRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_64px_28px] gap-1">
                      <select
                        className="input-shell text-xs"
                        value={row.category}
                        onChange={(e) =>
                          setQuotaRows((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, category: e.target.value } : r)),
                          )
                        }
                      >
                        <option value="">不限分类</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <select
                        className="input-shell text-xs"
                        value={row.type}
                        onChange={(e) =>
                          setQuotaRows((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, type: e.target.value } : r)),
                          )
                        }
                      >
                        <option value="any">不限题型</option>
                        <option value="single">单选</option>
                        <option value="tf">判断</option>
                        <option value="multiple">多选</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        className="input-shell text-xs"
                        value={row.count}
                        onChange={(e) =>
                          setQuotaRows((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, count: Number(e.target.value) || 1 } : r,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="text-xs text-zinc-400 hover:text-[#9e1b2b]"
                        onClick={() => setQuotaRows((rows) => rows.filter((_, i) => i !== idx))}
                        aria-label="删除配额行"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1 text-xs"
                    onClick={() =>
                      setQuotaRows((rows) => [...rows, { category: '', type: 'any', count: 3 }])
                    }
                  >
                    加一行
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1 text-xs"
                    onClick={() => composeByQuotas(quotaRows)}
                  >
                    按配额抽题
                  </Button>
                </div>
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

              <div className="flex items-center justify-between text-sm">
                <span className="text-[rgba(18,21,28,0.55)]">已选题总分</span>
                <span
                  className={
                    Math.abs(totalScore - 100) < 0.5
                      ? 'font-semibold text-[#1f6b4a]'
                      : 'font-semibold text-[#9e1b2b]'
                  }
                >
                  {totalScore} / 100
                  {Math.abs(totalScore - 100) >= 0.5 ? '（建议凑满约 100 分）' : ' ✓'}
                </span>
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
