import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch, apiUpload } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { withAccessToken } from '@/utils/fileLink'
import {
  BookOpen,
  UploadSimple,
  Paperclip,
  FloppyDisk,
  ArrowsClockwise,
  Trash,
  X,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import type { Content, ContentAttachment } from '../../shared/types'

type Attachment = ContentAttachment

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default function AdminContents() {
  const nav = useNavigate()
  const { user, token } = useAuthStore()
  const [items, setItems] = useState<Content[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) => {
      const tags = (c.tags ?? []).join(' ')
      const haystack = [c.title, c.category, c.type, c.body, tags, c.isPublic ? '公共' : '非公共']
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, query])

  const [form, setForm] = useState({
    type: 'article' as 'article' | 'video',
    title: '',
    body: '',
    category: '',
    tags: '',
    isPublic: false,
    attachments: [] as Attachment[],
  })

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Content[]>('/api/contents')
      setItems(data)
      setSelectedId((prev) => (prev && data.some((x) => x.id === prev) ? prev : data[0]?.id ?? null))
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
    if (!selected) {
      setForm((p) => ({ ...p, attachments: p.attachments }))
      return
    }
    setForm({
      type: selected.type,
      title: selected.title,
      body: selected.body,
      category: selected.category,
      tags: (selected.tags ?? []).join(','),
      isPublic: selected.isPublic,
      attachments: selected.attachments ?? [],
    })
  }, [selectedId])

  async function save() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const body = {
        type: form.type,
        title: form.title,
        body: form.body,
        category: form.category,
        tags: form.tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        isPublic: form.isPublic,
        attachments: form.attachments,
      }
      await apiFetch<void>(`/api/contents/${selected.id}`, { method: 'PUT', body: JSON.stringify(body) })
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
      const body = {
        type: form.type,
        title: form.title || '未命名内容',
        body: form.body || '',
        category: form.category || '未分类',
        tags: form.tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        isPublic: form.isPublic,
        attachments: form.attachments,
      }
      const res = await apiFetch<{ id: string }>('/api/contents', { method: 'POST', body: JSON.stringify(body) })
      await load()
      setSelectedId(res.id)
    } catch (e: any) {
      setError(e?.message ?? '创建失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch<void>(`/api/contents/${selected.id}`, { method: 'DELETE' })
      await load()
    } catch (e: any) {
      setError(e?.message ?? '删除失败')
    } finally {
      setSaving(false)
    }
  }

  async function onUploadFile(file: File | null) {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const att = await apiUpload<Attachment>('/api/contents/upload', file)
      setForm((p) => ({ ...p, attachments: [...p.attachments, att] }))
    } catch (e: any) {
      setError(e?.message ?? '上传失败')
    } finally {
      setUploading(false)
    }
  }

  function removeAttachment(id: string) {
    setForm((p) => ({ ...p, attachments: p.attachments.filter((a) => a.id !== id) }))
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">内容管理</div>
          <h1 className="page-title text-3xl md:text-4xl">学习内容</h1>
          <div className="page-subtitle mt-2 max-w-2xl">
            统一维护文章和视频内容，支持上传附件文件，并控制公共内容可见性。
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => load()} disabled={loading}>
            <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            刷新
          </Button>
          <Button variant="secondary" onClick={() => create()} disabled={saving}>
            <BookOpen className="h-4 w-4" />
            新建
          </Button>
          <Button onClick={() => save()} disabled={!selected || saving}>
            <FloppyDisk className="h-4 w-4" />
            保存
          </Button>
          <Button variant="danger" onClick={() => remove()} disabled={!selected || saving}>
            <Trash className="h-4 w-4" />
            删除
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[#9e1b2b]/10 px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(185,28,28,0.16)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle>
              内容列表
              <span className="ml-2 text-sm font-normal text-zinc-500">
                ({filteredItems.length}{query.trim() ? ` / ${items.length}` : ''})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center gap-2">
              <div className="input-shell flex min-w-0 flex-1 items-center gap-2 px-3">
                <MagnifyingGlass className="h-4 w-4 shrink-0 text-[#9e1b2b]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索标题 / 分类 / 标签 / 正文…"
                  className="w-full bg-transparent py-2 text-sm outline-none"
                />
                {query.trim() && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="rounded-full p-1 text-zinc-400 hover:bg-black/5 hover:text-[#9e1b2b]"
                    aria-label="清空搜索"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
              {filteredItems.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={[
                    'w-full rounded-2xl px-4 py-3 text-left transition',
                    'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]',
                    selectedId === c.id
                      ? 'bg-[linear-gradient(135deg,#9e1b2b_0%,#9e1b2b_55%,#450a0a_100%)] text-white'
                      : 'bg-white/90 text-black/80 hover:bg-[#9e1b2b]/5',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{c.title}</div>
                    <div className="text-xs opacity-80">{c.isPublic ? '公共' : '非公共'}</div>
                  </div>
                  <div className="mt-1 text-xs opacity-80">
                    {c.category} · {c.type}
                    {(c.attachments?.length ?? 0) > 0 ? ` · 附件 ${c.attachments.length}` : ''}
                  </div>
                </button>
              ))}
              {filteredItems.length === 0 && (
                <div className="py-10 text-sm text-[rgba(18,21,28,0.4)]">
                  {query.trim() ? '无匹配内容，试试其他关键词' : '暂无内容'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle>编辑内容</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1 text-sm">
                  <span className="field-label">类型</span>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as any }))}
                    className="input-shell"
                  >
                    <option value="article">文章</option>
                    <option value="video">视频</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="field-label">标题</span>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    className="input-shell"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1 text-sm md:col-span-1">
                  <span className="field-label">分类</span>
                  <input
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="input-shell"
                  />
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="field-label">标签（逗号分隔）</span>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                    className="input-shell"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-black/80">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(e) => setForm((p) => ({ ...p, isPublic: e.target.checked }))}
                  className="accent-[#9e1b2b]"
                />
                标记为公共内容
              </label>

              <label className="grid gap-1 text-sm">
                <span className="field-label">正文（视频类型可把 URL 放第一行）</span>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                  rows={10}
                  className="input-shell w-full resize-none px-4 py-3 text-black/80"
                />
              </label>

              <div className="grid gap-3 rounded-2xl bg-[#9e1b2b]/5 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(140,36,36,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#12151c]">
                      <Paperclip className="h-4 w-4 text-[#9e1b2b]" />
                      附件文件
                    </div>
                    <div className="mt-1 text-xs text-black/50">
                      支持 PDF / Office / 图片 / 视频 / ZIP 等，单文件最大 50MB。上传后请点击「保存」写入内容。
                    </div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploading}
                      onChange={async (e) => {
                        await onUploadFile(e.target.files?.[0] ?? null)
                        e.currentTarget.value = ''
                      }}
                    />
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#9e1b2b] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(140,36,36,0.18)]">
                      <UploadSimple className="h-4 w-4" />
                      {uploading ? '上传中…' : '上传文件'}
                    </span>
                  </label>
                </div>

                <div className="grid gap-2">
                  {form.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                    >
                      <a
                        href={withAccessToken(att.url, token)}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-sm font-medium text-[#9e1b2b] hover:underline"
                      >
                        {att.name}
                      </a>
                      <div className="shrink-0 text-xs text-black/45">{formatSize(att.size)}</div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#9e1b2b]/10 text-[#9e1b2b] hover:bg-[#9e1b2b]/16"
                        title="移除附件"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {form.attachments.length === 0 && (
                    <div className="py-4 text-center text-sm text-black/40">暂无附件，点击右上角上传</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
