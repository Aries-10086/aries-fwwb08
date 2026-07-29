import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { fileToTabularText } from '@/utils/spreadsheet'
import { useAuthStore } from '@/store/auth'
import {
  UploadSimple,
  Plus,
  ArrowsClockwise,
  Users,
  PencilSimpleLine,
  Trash,
  MagnifyingGlass,
  FloppyDisk,
  X,
} from '@phosphor-icons/react'

type Org = { id: string; name: string; parentId: string | null }
import type { User as SharedUser } from '../../shared/types'

type User = SharedUser

export default function AdminUsers() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [items, setItems] = useState<User[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [csvText, setCsvText] = useState(
    'name,username,password,role,orgUnitName\n张三,zhangsan,Pass1234,member,第三党支部\n李四,lisi,Pass1234,member,第三党支部',
  )
  const [saving, setSaving] = useState(false)
  const [filters, setFilters] = useState({
    name: '',
    role: '',
    orgUnitId: searchParams.get('orgUnitId') ?? '',
  })
  const [importFileName, setImportFileName] = useState('')
  const [listQuery, setListQuery] = useState('')

  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'member', orgUnitId: 'org_branch_3' })

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  const orgName = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs])
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId])

  const listFiltered = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return items
    return items.filter((u) => {
      const haystack = [u.name, u.username ?? '', u.role, orgName.get(u.orgUnitId) ?? u.orgUnitId]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, listQuery, orgName])

  async function load(nextFilters = filters, preferUserId?: string | null) {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      if (nextFilters.name.trim()) query.set('name', nextFilters.name.trim())
      if (nextFilters.role) query.set('role', nextFilters.role)
      if (nextFilters.orgUnitId) query.set('orgUnitId', nextFilters.orgUnitId)

      const [o, u] = await Promise.all([
        apiFetch<Org[]>('/api/org-units'),
        apiFetch<User[]>(`/api/users${query.size ? `?${query.toString()}` : ''}`),
      ])
      setOrgs(o)
      setItems(u)
      const preferred = preferUserId && u.some((item) => item.id === preferUserId) ? preferUserId : null
      setSelectedId((prev) => preferred ?? (prev && u.some((item) => item.id === prev) ? prev : u[0]?.id ?? null))
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const orgFromUrl = searchParams.get('orgUnitId') ?? ''
    const userFromUrl = searchParams.get('userId')
    const next = { ...filters, orgUnitId: orgFromUrl || filters.orgUnitId }
    setFilters(next)
    void load(next, userFromUrl)
  }, [searchParams])

  useEffect(() => {
    if (!selected) {
      setForm({
        name: '',
        username: '',
        password: '',
        role: 'member',
        orgUnitId: filters.orgUnitId || orgs.find((o) => o.parentId)?.id || 'org_branch_3',
      })
      return
    }
    setForm({
      name: selected.name,
      username: selected.username ?? '',
      password: '',
      role: selected.role,
      orgUnitId: selected.orgUnitId,
    })
  }, [selectedId, orgs, filters.orgUnitId])

  async function create() {
    setError(null)
    setSaving(true)
    try {
      await apiFetch<{ id: string }>('/api/users', { method: 'POST', body: JSON.stringify(form) })
      setSelectedId(null)
      setForm((p) => ({ ...p, name: '', username: '', password: '' }))
      await load()
    } catch (e: any) {
      setError(e?.message ?? '创建失败')
    } finally {
      setSaving(false)
    }
  }

  async function update() {
    if (!selected) return
    setError(null)
    setSaving(true)
    try {
      await apiFetch<void>(`/api/users/${selected.id}`, { method: 'PUT', body: JSON.stringify(form) })
      await load()
    } catch (e: any) {
      setError(e?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      await apiFetch<void>(`/api/users/${id}`, { method: 'DELETE' })
      if (selectedId === id) setSelectedId(null)
      await load()
    } catch (e: any) {
      setError(e?.message ?? '删除失败')
    }
  }

  async function importCsv() {
    setError(null)
    try {
      await apiFetch<any>('/api/users/import', { method: 'POST', body: JSON.stringify({ csvText }) })
      await load()
    } catch (e: any) {
      setError(e?.message ?? '导入失败')
    }
  }

  async function onImportFile(file: File | null) {
    if (!file) return
    setError(null)
    try {
      const text = await fileToTabularText(file)
      setCsvText(text)
      setImportFileName(file.name)
    } catch (e: any) {
      setError(e?.message ?? '文件解析失败')
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">人员管理</div>
          <h1 className="page-title text-3xl md:text-4xl">人员管理</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="input-shell flex items-center gap-2 px-3 py-2">
            <MagnifyingGlass className="h-4 w-4 text-[#9e1b2b]" />
            <input
              value={filters.name}
              onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))}
              placeholder="按姓名搜索"
              className="w-[140px] bg-transparent text-sm outline-none"
            />
          </div>
          <select value={filters.role} onChange={(e) => setFilters((p) => ({ ...p, role: e.target.value }))} className="input-shell min-w-[120px]">
            <option value="">全部角色</option>
            <option value="member">党员</option>
            <option value="secretary">支部书记</option>
            <option value="admin">系统管理员</option>
          </select>
          <select
            value={filters.orgUnitId}
            onChange={(e) => setFilters((p) => ({ ...p, orgUnitId: e.target.value }))}
            className="input-shell min-w-[150px]"
          >
            <option value="">全部支部</option>
            {orgs
              .filter((o) => o.parentId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
          <Button variant="secondary" onClick={() => load()} disabled={loading}>
            <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            搜索
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
            <CardTitle className="flex items-center gap-2">
              {selected ? <PencilSimpleLine className="h-5 w-5 text-[#9e1b2b]" /> : <Plus className="h-5 w-5 text-[#9e1b2b]" />}
              {selected ? '编辑人员' : '新增人员'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="field-label">姓名</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="input-shell"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="field-label">登录账号</span>
                <input
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  className="input-shell"
                  placeholder="例如：zhangsan"
                  autoComplete="off"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="field-label">{selected ? '重置密码（留空则不改）' : '登录密码'}</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  className="input-shell"
                  placeholder={selected ? '不修改请留空' : '至少 6 位'}
                  autoComplete="new-password"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="field-label">角色</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  className="input-shell"
                >
                  <option value="member">党员</option>
                  <option value="secretary">支部书记</option>
                  <option value="admin">系统管理员</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="field-label">所属组织</span>
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
              <div className="flex flex-wrap gap-2">
                {selected ? (
                  <>
                    <Button
                      onClick={() => update()}
                      disabled={!form.name.trim() || !form.username.trim() || saving}
                    >
                      <FloppyDisk className="h-4 w-4" />
                      保存
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelectedId(null)
                        setForm({
                          name: '',
                          username: '',
                          password: '',
                          role: 'member',
                          orgUnitId: orgs.find((o) => o.parentId)?.id ?? 'org_branch_3',
                        })
                      }}
                    >
                      新建模式
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => create()}
                    disabled={!form.name.trim() || !form.username.trim() || form.password.length < 6 || saving}
                  >
                    <Users className="h-4 w-4" />
                    创建
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadSimple className="h-5 w-5 text-[#9e1b2b]" />
              批量导入（Excel/CSV 粘贴）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="text-xs text-black/60">
                支持 CSV 或从 Excel 直接复制粘贴的制表符内容。列名支持：name/姓名、username/账号/用户名、password/密码（必填且至少 6 位）、role/角色、orgUnitId/支部ID、orgUnitName/支部。
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
                  className="input-shell cursor-pointer file:mr-3 file:rounded-full file:border-0 file:bg-[#9e1b2b] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
                {importFileName ? <div className="text-xs text-black/55">已载入：{importFileName}</div> : null}
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={8}
                className="input-shell w-full resize-none px-4 py-3 font-mono text-xs text-black/80"
              />
              <Button onClick={() => importCsv()}>
                <UploadSimple className="h-4 w-4" />
                导入
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            人员列表
            <span className="ml-2 text-sm font-normal text-zinc-500">
              ({listFiltered.length}
              {listQuery.trim() ? ` / ${items.length}` : ''})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center gap-2">
            <div className="input-shell flex min-w-0 flex-1 items-center gap-2 px-3">
              <MagnifyingGlass className="h-4 w-4 shrink-0 text-[#9e1b2b]" />
              <input
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder="按姓名或账号搜索…"
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
              {listQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setListQuery('')}
                  className="rounded-full p-1 text-zinc-400 hover:bg-black/5 hover:text-[#9e1b2b]"
                  aria-label="清空搜索"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            {listFiltered.map((u) => (
              <div
                key={u.id}
                className={[
                  'grid items-center gap-3 rounded-2xl px-4 py-4 transition',
                  'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
                  selectedId === u.id ? 'bg-[#9e1b2b]/6' : 'bg-white/90',
                  'md:grid-cols-[1.4fr_0.8fr_1.2fr_0.9fr_auto]',
                ].join(' ')}
              >
                <button className="text-left" onClick={() => setSelectedId(u.id)}>
                  <div className="text-sm font-medium text-[#12151c]">{u.name}</div>
                  <div className="mt-1 text-xs text-black/45">
                    {u.username ? `@${u.username}` : u.id}
                  </div>
                </button>
                <div className="text-xs text-black/60">{u.role}</div>
                <div className="text-xs text-black/60">{orgName.get(u.orgUnitId) ?? u.orgUnitId}</div>
                <div className="text-xs text-black/50">{new Date(u.createdAt).toLocaleDateString()}</div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" className="px-3 py-2 text-xs" onClick={() => setSelectedId(u.id)}>
                    编辑
                  </Button>
                  <Button variant="danger" className="px-3 py-2 text-xs" onClick={() => remove(u.id)}>
                    <Trash className="h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
              </div>
            ))}
            {listFiltered.length === 0 && (
              <div className="py-10 text-sm text-black/45">
                {listQuery.trim() ? '无匹配人员，试试其他姓名或账号' : '暂无人员'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
