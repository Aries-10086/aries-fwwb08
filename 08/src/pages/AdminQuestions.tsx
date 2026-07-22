import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { fileToTabularText } from '@/utils/spreadsheet'
import { useAuthStore } from '@/store/auth'
import { RotateCw, Save, Upload, Plus } from 'lucide-react'

type Question = {
  id: string
  type: 'single' | 'multiple' | 'tf'
  category: string
  stem: string
  options: any
  answerKey: any
  updatedAt: string
}

function safeJson(text: string) {
  if (!text.trim()) return null
  return JSON.parse(text)
}

export default function AdminQuestions() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [items, setItems] = useState<Question[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFileName, setImportFileName] = useState('')
  const [importText, setImportText] = useState(
    'type,category,stem,optionsJson,answerKeyJson\nsingle,党史,中国共产党成立于哪一年?,"[{""key"":""A"",""text"":""1921""},{""key"":""B"",""text"":""1949""}]",""A""',
  )

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId])

  const [form, setForm] = useState({
    type: 'single' as 'single' | 'multiple' | 'tf',
    category: '',
    stem: '',
    optionsJson: '',
    answerKeyJson: '',
  })

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Question[]>('/api/questions')
      setItems(data)
      setSelectedId(data[0]?.id ?? null)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!selected) return
    setForm({
      type: selected.type,
      category: selected.category,
      stem: selected.stem,
      optionsJson: selected.options ? JSON.stringify(selected.options, null, 2) : '',
      answerKeyJson: selected.answerKey !== null && selected.answerKey !== undefined ? JSON.stringify(selected.answerKey, null, 2) : '',
    })
  }, [selectedId])

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
    } catch (e: any) {
      setError(e?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function create() {
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch<{ id: string }>('/api/questions', {
        method: 'POST',
        body: JSON.stringify({
          type: 'single',
          category: '未分类',
          stem: '新题目',
          options: null,
          answerKey: null,
        }),
      })
      await load()
      setSelectedId(res.id)
    } catch (e: any) {
      setError(e?.message ?? '创建失败')
    } finally {
      setSaving(false)
    }
  }

  async function importBatch() {
    setImporting(true)
    setError(null)
    try {
      await apiFetch('/api/questions/import', {
        method: 'POST',
        body: JSON.stringify({ csvText: importText }),
      })
      await load()
    } catch (e: any) {
      setError(e?.message ?? '导入失败')
    } finally {
      setImporting(false)
    }
  }

  async function onImportFile(file: File | null) {
    if (!file) return
    setError(null)
    try {
      const text = await fileToTabularText(file)
      setImportText(text)
      setImportFileName(file.name)
    } catch (e: any) {
      setError(e?.message ?? '文件解析失败')
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-400">管理后台</div>
          <h1 className="mt-2 text-2xl font-[850] tracking-[-0.05em] text-zinc-50">题库管理</h1>
          <div className="mt-2 text-sm text-zinc-300/90">单选 / 多选 / 判断题</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => load()} disabled={loading}>
            <RotateCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            刷新
          </Button>
          <Button variant="secondary" onClick={() => create()} disabled={saving}>
            <Plus className="h-4 w-4" />
            新建
          </Button>
          <Button onClick={() => save()} disabled={!selected || saving}>
            <Save className="h-4 w-4" />
            保存
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-500/10 px-4 py-3 text-rose-200 shadow-[0_0_0_1px_rgba(244,63,94,0.25)]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-[#8c2424]" />
            题库批量导入
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="text-xs text-black/60">
              支持 CSV 或从 Excel 复制粘贴的制表符内容。字段：type、category、stem、optionsJson、answerKeyJson，其中后两项需为合法 JSON。
            </div>
            <label className="grid gap-2 text-sm">
              <span className="field-label">上传文件（.xlsx/.xls/.csv）</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={async (e) => {
                  await onImportFile(e.target.files?.[0] ?? null)
                  e.currentTarget.value = ''
                }}
                className="input-shell cursor-pointer file:mr-3 file:rounded-full file:border-0 file:bg-[#8c2424] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              {importFileName ? <div className="text-xs text-black/55">已载入：{importFileName}</div> : null}
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={5}
              className="input-shell w-full resize-none px-4 py-3 font-mono text-xs text-black/80"
            />
            <div>
              <Button onClick={() => importBatch()} disabled={!importText.trim() || importing}>
                <Upload className="h-4 w-4" />
                {importing ? '导入中…' : '执行导入'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle>题目列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
              {items.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedId(q.id)}
                  className={[
                    'w-full rounded-lg px-4 py-3 text-left transition',
                    'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]',
                    selectedId === q.id ? 'bg-amber-300/90 text-zinc-950' : 'bg-white/5 text-zinc-200 hover:bg-white/10',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{q.category}</div>
                    <div className="text-xs opacity-80">{q.type}</div>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs opacity-80">{q.stem}</div>
                </button>
              ))}
              {items.length === 0 && <div className="py-10 text-sm text-zinc-400">暂无题目</div>}
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
                    <span className="text-xs text-zinc-400">题型</span>
                    <select
                      value={form.type}
                      onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as any }))}
                      className="rounded-lg bg-black/30 px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none"
                    >
                      <option value="single">单选</option>
                      <option value="multiple">多选</option>
                      <option value="tf">判断</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span className="text-xs text-zinc-400">分类</span>
                    <input
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      className="rounded-lg bg-black/30 px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none"
                    />
                  </label>
                </div>

                <label className="grid gap-1 text-sm">
                  <span className="text-xs text-zinc-400">题干</span>
                  <textarea
                    value={form.stem}
                    onChange={(e) => setForm((p) => ({ ...p, stem: e.target.value }))}
                    rows={5}
                    className="w-full resize-none rounded-lg bg-black/30 px-3 py-2 text-sm text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none"
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="text-xs text-zinc-400">optionsJson（单选/多选用）</span>
                    <textarea
                      value={form.optionsJson}
                      onChange={(e) => setForm((p) => ({ ...p, optionsJson: e.target.value }))}
                      rows={8}
                      className="w-full resize-none rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-xs text-zinc-400">answerKeyJson</span>
                    <textarea
                      value={form.answerKeyJson}
                      onChange={(e) => setForm((p) => ({ ...p, answerKeyJson: e.target.value }))}
                      rows={8}
                      className="w-full resize-none rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="py-10 text-sm text-zinc-400">请选择题目</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
