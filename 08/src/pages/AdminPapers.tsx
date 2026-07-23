import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { Plus, RotateCw, Trash2 } from 'lucide-react'

type Question = { id: string; type: string; category: string; stem: string }
type Paper = { id: string; title: string; durationMin: number; passScore: number; questions: { questionId: string; score: number; orderNo: number }[] }

export default function AdminPapers() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [items, setItems] = useState<Paper[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    title: '新试卷（演示）',
    durationMin: 10,
    passScore: 60,
    picks: [] as Array<{ questionId: string; score: number }>,
  })

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [p, q] = await Promise.all([apiFetch<Paper[]>('/api/papers'), apiFetch<Question[]>('/api/questions')])
      setItems(p)
      setQuestions(q)
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
      const questions = form.picks.map((p, idx) => ({ questionId: p.questionId, score: p.score, orderNo: idx + 1 }))
      await apiFetch<{ id: string }>('/api/papers', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          durationMin: form.durationMin,
          passScore: form.passScore,
          questions,
        }),
      })
      setForm((p) => ({ ...p, picks: [] }))
      await load()
    } catch (e: any) {
      setError(e?.message ?? '创建失败')
    }
  }

  async function remove(id: string) {
    if (!confirm('确认删除该试卷？若已被测验引用将无法删除。')) return
    setError(null)
    try {
      await apiFetch<void>(`/api/papers/${id}`, { method: 'DELETE' })
      await load()
    } catch (e: any) {
      setError(e?.message ?? '删除失败')
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">管理后台</div>
          <h1 className="page-title text-3xl md:text-4xl">试卷管理</h1>
          <div className="page-subtitle mt-2 max-w-2xl">组卷（题目 + 分值 + 顺序）</div>
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
              <Plus className="h-5 w-5 text-[#a31828]" />
              新建试卷
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
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
              </div>

              <div className="text-xs text-zinc-500">选择题目（点击添加到试卷）</div>
              <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
                {questions.map((q) => {
                  const picked = form.picks.some((p) => p.questionId === q.id)
                  return (
                    <button
                      key={q.id}
                      disabled={picked}
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          picks: [...p.picks, { questionId: q.id, score: 30 }],
                        }))
                      }
                      className={[
                        'w-full rounded-lg px-3 py-2 text-left text-sm transition',
                        'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
                        picked ? 'bg-white/90 text-zinc-400' : 'bg-white/90 text-[#0e1116] hover:bg-[rgba(163,24,40,0.05)]',
                      ].join(' ')}
                    >
                      <div className="text-xs text-zinc-500">{q.category} · {q.type}</div>
                      <div className="mt-1 line-clamp-2">{q.stem}</div>
                    </button>
                  )
                })}
              </div>

              <div className="text-xs text-zinc-500">已选题目（可调整分值）</div>
              <div className="grid gap-2">
                {form.picks.map((p, idx) => (
                  <div
                    key={p.questionId}
                    className="rounded-lg bg-white/90 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-[#0e1116]">#{idx + 1} {qById.get(p.questionId)?.category ?? ''}</div>
                      <input
                        type="number"
                        value={p.score}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setForm((prev) => ({
                            ...prev,
                            picks: prev.picks.map((x) => (x.questionId === p.questionId ? { ...x, score: v } : x)),
                          }))
                        }}
                        className="input-shell w-20 px-2 py-1"
                      />
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 line-clamp-2">{qById.get(p.questionId)?.stem ?? p.questionId}</div>
                  </div>
                ))}
                {form.picks.length === 0 && <div className="text-sm text-zinc-400">还未选择题目</div>}
              </div>

              <Button onClick={() => create()} disabled={form.picks.length === 0}>
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
              {items.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl bg-white/90 p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#0e1116]">{p.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {p.durationMin} 分钟 · 及格 {p.passScore}
                      </div>
                    </div>
                    <Button variant="danger" className="px-3" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4" />
                      删除
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {p.questions.map((q) => (
                      <div
                        key={q.questionId}
                        className="rounded-lg bg-white/90 px-4 py-3 text-sm text-[rgba(14,17,22,0.7)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                      >
                        {qById.get(q.questionId)?.stem ?? q.questionId}
                        <div className="mt-1 text-xs text-zinc-500">分值 {q.score}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="py-10 text-sm text-zinc-400">暂无试卷</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
