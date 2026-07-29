import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ArrowLeft,
  ArrowsClockwise,
  FloppyDisk,
  Plus,
  Trash,
} from '@phosphor-icons/react'

type QuestionType = 'single' | 'multiple' | 'tf'

type Question = {
  id: string
  type: QuestionType
  category: string
  stem: string
  options: { key: string; text: string }[] | null
  answerKey: unknown
  updatedAt: string
}

const TYPE_META: Record<
  QuestionType,
  { label: string; path: string }
> = {
  single: {
    label: '单选题',
    path: 'single',
  },
  tf: {
    label: '判断题',
    path: 'tf',
  },
  multiple: {
    label: '多选题',
    path: 'multiple',
  },
}

function safeJson(text: string) {
  if (!text.trim()) return null
  return JSON.parse(text)
}

function isQuestionType(value: string | undefined): value is QuestionType {
  return value === 'single' || value === 'multiple' || value === 'tf'
}

export default function AdminQuestionsType() {
  const nav = useNavigate()
  const { type: typeParam } = useParams()
  const { user } = useAuthStore()
  const questionType = isQuestionType(typeParam) ? typeParam : null

  const [items, setItems] = useState<Question[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const meta = questionType ? TYPE_META[questionType] : null
  const filtered = useMemo(
    () => (questionType ? items.filter((x) => x.type === questionType) : []),
    [items, questionType],
  )
  const selected = useMemo(
    () => filtered.find((x) => x.id === selectedId) ?? null,
    [filtered, selectedId],
  )

  const [form, setForm] = useState({
    type: 'single' as QuestionType,
    category: '',
    stem: '',
    optionsJson: '',
    answerKeyJson: '',
  })

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
    if (typeParam && !isQuestionType(typeParam)) nav('/admin/questions', { replace: true })
  }, [nav, user, typeParam])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Question[]>('/api/questions')
      setItems(data)
      const next = questionType ? data.filter((x) => x.type === questionType) : []
      setSelectedId((prev) => (prev && next.some((x) => x.id === prev) ? prev : next[0]?.id ?? null))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (questionType) void load()
  }, [questionType])

  useEffect(() => {
    if (!selected) return
    setForm({
      type: selected.type,
      category: selected.category,
      stem: selected.stem,
      optionsJson: selected.options ? JSON.stringify(selected.options, null, 2) : '',
      answerKeyJson:
        selected.answerKey !== null && selected.answerKey !== undefined
          ? JSON.stringify(selected.answerKey, null, 2)
          : '',
    })
  }, [selectedId, selected])

  async function save() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch<void>(`/api/questions/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          type: form.type,
          category: form.category,
          stem: form.stem,
          options: safeJson(form.optionsJson),
          answerKey: safeJson(form.answerKeyJson),
        }),
      })
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!selected) return
    if (!confirm('确认删除该题目？若已被试卷引用将无法删除。')) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch<void>(`/api/questions/${selected.id}`, { method: 'DELETE' })
      setSelectedId(null)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setSaving(false)
    }
  }

  async function create() {
    if (!questionType) return
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch<{ id: string }>('/api/questions', {
        method: 'POST',
        body: JSON.stringify({
          type: questionType,
          category: '未分类',
          stem: '新题目',
          options: questionType === 'tf' ? null : [{ key: 'A', text: '选项 A' }, { key: 'B', text: '选项 B' }],
          answerKey: questionType === 'tf' ? true : questionType === 'multiple' ? ['A'] : 'A',
        }),
      })
      await load()
      setSelectedId(res.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setSaving(false)
    }
  }

  if (!questionType || !meta) return null

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/admin/questions"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-[rgba(18,21,28,0.55)] hover:text-[#9e1b2b]"
          >
            <ArrowLeft className="h-4 w-4" />
            返回题型入口
          </Link>
          <div className="page-eyebrow">管理后台 · 题库</div>
          <h1 className="page-title text-3xl md:text-4xl">{meta.label}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void load()} disabled={loading}>
            <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            刷新
          </Button>
          <Button variant="secondary" onClick={() => void create()} disabled={saving}>
            <Plus className="h-4 w-4" />
            新建
          </Button>
          <Button onClick={() => void save()} disabled={!selected || saving}>
            <FloppyDisk className="h-4 w-4" />
            保存
          </Button>
          <Button variant="danger" onClick={() => void remove()} disabled={!selected || saving}>
            <Trash className="h-4 w-4" />
            删除
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle>
              {meta.label}列表
              <span className="ml-2 text-sm font-normal text-zinc-500">({filtered.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
              {filtered.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedId(q.id)}
                  className={[
                    'w-full rounded-2xl px-4 py-3 text-left transition',
                    'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]',
                    selectedId === q.id
                      ? 'bg-[#9e1b2b] text-white'
                      : 'bg-white/90 text-black/80 hover:bg-[rgba(158,27,43,0.05)]',
                  ].join(' ')}
                >
                  <div className="text-sm font-medium">{q.category}</div>
                  <div className="mt-1 line-clamp-2 text-xs opacity-80">{q.stem}</div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="py-10 text-center text-sm text-zinc-400">
                  暂无{meta.label}
                  <div className="mt-3">
                    <Button variant="secondary" onClick={() => void create()} disabled={saving}>
                      新建第一题
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle>编辑题目</CardTitle>
          </CardHeader>
          <CardContent>
            {selected ? (
              <div className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-1 text-sm">
                    <span className="field-label">题型</span>
                    <select
                      value={form.type}
                      onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as QuestionType }))}
                      className="input-shell"
                    >
                      <option value="single">单选</option>
                      <option value="multiple">多选</option>
                      <option value="tf">判断</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span className="field-label">分类</span>
                    <input
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      className="input-shell"
                    />
                  </label>
                </div>

                <label className="grid gap-1 text-sm">
                  <span className="field-label">题干</span>
                  <textarea
                    value={form.stem}
                    onChange={(e) => setForm((p) => ({ ...p, stem: e.target.value }))}
                    rows={5}
                    className="input-shell w-full resize-none px-4 py-3 text-black/80"
                  />
                </label>

                {form.type !== 'tf' && (
                  <label className="grid gap-1 text-sm">
                    <span className="field-label">选项（optionsJson）</span>
                    <textarea
                      value={form.optionsJson}
                      onChange={(e) => setForm((p) => ({ ...p, optionsJson: e.target.value }))}
                      rows={8}
                      className="input-shell w-full resize-none px-4 py-3 font-mono text-xs text-black/80"
                    />
                  </label>
                )}

                <label className="grid gap-1 text-sm">
                  <span className="field-label">
                    答案（answerKeyJson）
                    {form.type === 'tf' ? ' · 填 true 或 false' : form.type === 'multiple' ? ' · 填 ["A","B"]' : ' · 填 "A"'}
                  </span>
                  <textarea
                    value={form.answerKeyJson}
                    onChange={(e) => setForm((p) => ({ ...p, answerKeyJson: e.target.value }))}
                    rows={form.type === 'tf' ? 3 : 5}
                    className="input-shell w-full resize-none px-4 py-3 font-mono text-xs text-black/80"
                  />
                </label>
              </div>
            ) : (
              <div className="py-10 text-sm text-zinc-400">请从左侧选择题目，或新建一题</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
