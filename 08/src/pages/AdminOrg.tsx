import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { Network, Plus, RotateCw, Trash2 } from 'lucide-react'

type OrgMember = { id: string; name: string; role: string }

type Org = {
  id: string
  name: string
  parentId: string | null
  stats: {
    memberCount: number
    taskCount: number
    avgExamScore: number
    completionRate: number
  }
  members: OrgMember[]
}

const roleLabels: Record<string, string> = {
  member: '党员',
  secretary: '支部书记',
  admin: '系统管理员',
}

export default function AdminOrg() {
  const nav = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const [items, setItems] = useState<Org[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>('org_committee')

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Org[]>('/api/org-units')
      setItems(data)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [location.pathname])

  const roots = useMemo(() => items.filter((x) => !x.parentId), [items])
  const childrenByParent = useMemo(() => {
    const m = new Map<string, Org[]>()
    for (const it of items) {
      if (!it.parentId) continue
      const list = m.get(it.parentId) ?? []
      list.push(it)
      m.set(it.parentId, list)
    }
    return m
  }, [items])

  async function create() {
    setError(null)
    try {
      await apiFetch<{ id: string }>('/api/org-units', {
        method: 'POST',
        body: JSON.stringify({ name, parentId: parentId || null }),
      })
      setName('')
      await load()
    } catch (e: any) {
      setError(e?.message ?? '创建失败')
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      await apiFetch<void>(`/api/org-units/${id}`, { method: 'DELETE' })
      await load()
    } catch (e: any) {
      setError(e?.message ?? '删除失败')
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">组织架构</div>
          <h1 className="page-title text-3xl md:text-4xl">组织架构</h1>
          <div className="page-subtitle mt-2 max-w-2xl">支持至少 2 级结构管理，并为各支部展示成员、任务、完成率与测验均分。</div>
        </div>
        <Button variant="ghost" onClick={() => load()} disabled={loading}>
          <RotateCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[#a31828]/10 px-4 py-3 text-[#7a1020] shadow-[inset_0_0_0_1px_rgba(185,28,28,0.16)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-[#a31828]" />
              新增组织
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="field-label">组织名称</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-shell"
                  placeholder="例如：第四党支部"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="field-label">上级组织</span>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="input-shell"
                >
                  {items
                    .filter((x) => !x.parentId)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </label>
              <Button onClick={() => create()} disabled={!name.trim()}>
                <Plus className="h-4 w-4" />
                创建
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle>组织列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {roots.map((r) => (
                <div key={r.id} className="list-surface">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-[#0e1116]">{r.name}</div>
                    <div className="text-xs text-black/45">{r.id}</div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(childrenByParent.get(r.id) ?? []).map((c) => (
                      <div key={c.id} className="rounded-2xl bg-white/85 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-[#0e1116]">{c.name}</div>
                            <div className="mt-1 text-xs text-black/45">{c.id}</div>
                          </div>
                          <button
                            onClick={() => remove(c.id)}
                            className="inline-flex items-center gap-2 rounded-full bg-[#a31828]/10 px-3 py-2 text-xs font-medium text-[#a31828] shadow-[inset_0_0_0_1px_rgba(185,28,28,0.16)] transition hover:bg-[#a31828]/14"
                          >
                            <Trash2 className="h-3 w-3" />
                            删除
                          </button>
                        </div>
                        <div className="mt-4 grid gap-2 md:grid-cols-4">
                          {[
                            ['成员数', `${c.stats.memberCount}`],
                            ['任务数', `${c.stats.taskCount}`],
                            ['完成率', `${c.stats.completionRate}%`],
                            ['测验均分', `${c.stats.avgExamScore}`],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-xl bg-[#a31828]/5 px-3 py-3 shadow-[inset_0_0_0_1px_rgba(140,36,36,0.08)]">
                              <div className="text-[11px] uppercase tracking-[0.24em] text-[#a31828]/60">{label}</div>
                              <div className="mt-2 text-lg font-bold tracking-[-0.04em] text-[#0e1116]">{value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4">
                          <div className="text-[11px] uppercase tracking-[0.24em] text-[#a31828]/60">组织成员</div>
                          {c.members.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {c.members.map((member) => (
                                <div
                                  key={member.id}
                                  className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                                >
                                  <span className="font-medium text-[#0e1116]">{member.name}</span>
                                  <span className="text-black/45">{roleLabels[member.role] ?? member.role}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-black/45">暂无成员，请在「人员管理」中为该组织添加人员</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {(childrenByParent.get(r.id) ?? []).length === 0 && (
                      <div className="text-sm text-black/45">暂无下级组织</div>
                    )}
                  </div>
                </div>
              ))}
              {roots.length === 0 && <div className="py-10 text-sm text-black/45">暂无组织</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
