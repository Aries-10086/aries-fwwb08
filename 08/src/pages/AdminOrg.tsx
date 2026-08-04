import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  TreeStructure,
  Plus,
  ArrowsClockwise,
  Trash,
  ArrowRight,
  ArrowLeft,
  Users,
} from '@phosphor-icons/react'

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
  const { id: orgId } = useParams()
  const { user } = useAuthStore()
  const [items, setItems] = useState<Org[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>('org_committee')

  const forceMembers = Boolean(orgId && /\/members\/?$/.test(location.pathname))

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const current = useMemo(
    () => (orgId ? items.find((x) => x.id === orgId) ?? null : null),
    [items, orgId],
  )

  const roots = useMemo(() => items.filter((x) => !x.parentId), [items])

  const children = useMemo(() => {
    if (!orgId) return []
    return items.filter((x) => x.parentId === orgId)
  }, [items, orgId])

  const parentOrg = useMemo(() => {
    if (!current?.parentId) return null
    return items.find((x) => x.id === current.parentId) ?? null
  }, [current, items])

  // 无 id：党委列表；党委默认看党支部；党委/支部 + /members 或支部 id：人员
  const level: 'committee' | 'branch' | 'members' = !orgId
    ? 'committee'
    : forceMembers || Boolean(current?.parentId)
      ? 'members'
      : 'branch'

  const isCommitteeMembers = level === 'members' && current && !current.parentId

  useEffect(() => {
    if (!items.length) return
    if (orgId && !current) {
      setError('组织不存在')
    }
    if (level === 'committee' && roots[0]) {
      setParentId(roots[0].id)
    } else if (level === 'branch' && orgId) {
      setParentId(orgId)
    }
  }, [items, orgId, current, level, roots])

  async function create() {
    setError(null)
    try {
      const body =
        level === 'committee'
          ? { name, parentId: null }
          : { name, parentId: parentId || null }
      await apiFetch<{ id: string }>('/api/org-units', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setName('')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建失败')
    }
  }

  async function remove(id: string) {
    if (!confirm('确认删除该组织？存在下级或成员时将无法删除。')) return
    setError(null)
    try {
      await apiFetch<void>(`/api/org-units/${id}`, { method: 'DELETE' })
      if (orgId === id) {
        nav(parentOrg ? `/admin/org/${parentOrg.id}` : '/admin/org')
      } else {
        await load()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  const backTo =
    level === 'members'
      ? isCommitteeMembers
        ? '/admin/org'
        : parentOrg
          ? `/admin/org/${parentOrg.id}`
          : '/admin/org'
      : '/admin/org'

  const backLabel =
    level === 'members'
      ? isCommitteeMembers
        ? '返回党委列表'
        : `返回 ${parentOrg?.name ?? '上级组织'}`
      : '返回党委列表'

  const title =
    level === 'committee'
      ? '党委'
      : level === 'branch'
        ? `${current?.name ?? ''} · 党支部`
        : `${current?.name ?? ''} · 组织成员`

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {level !== 'committee' && (
            <Link
              to={backTo}
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-[rgba(18,21,28,0.55)] hover:text-[#9e1b2b]"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          )}
          <div className="page-eyebrow">组织架构</div>
          <h1 className="page-title text-3xl md:text-4xl">{title}</h1>
          {level !== 'committee' && current && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[rgba(18,21,28,0.5)]">
              <Link to="/admin/org" className="hover:text-[#9e1b2b]">
                党委
              </Link>
              {parentOrg && (
                <>
                  <span>/</span>
                  <Link to={`/admin/org/${parentOrg.id}`} className="hover:text-[#9e1b2b]">
                    {parentOrg.name}
                  </Link>
                </>
              )}
              {!parentOrg && level === 'members' ? (
                <>
                  <span>/</span>
                  <Link to={`/admin/org/${current.id}`} className="hover:text-[#9e1b2b]">
                    {current.name}
                  </Link>
                  <span>/</span>
                  <span className="font-medium text-[#12151c]">人员</span>
                </>
              ) : (
                <>
                  <span>/</span>
                  <span className="font-medium text-[#12151c]">{current.name}</span>
                  {level === 'members' && current.parentId && (
                    <>
                      <span>/</span>
                      <span className="font-medium text-[#12151c]">人员</span>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <Button variant="ghost" onClick={() => void load()} disabled={loading}>
          <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[#9e1b2b]/10 px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(185,28,28,0.16)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-12">
        {level !== 'members' && (
          <Card className="md:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TreeStructure className="h-5 w-5 text-[#9e1b2b]" />
                {level === 'committee' ? '新增党委' : '新增党支部'}
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
                    placeholder={level === 'committee' ? '例如：市直党委' : '例如：第四党支部'}
                  />
                </label>
                {level === 'committee' ? (
                  <div className="text-xs text-[rgba(18,21,28,0.5)]">
                    新建党委为顶级组织（无上级）。党支部请进入某党委后再创建。
                  </div>
                ) : (
                  <label className="grid gap-1 text-sm">
                    <span className="field-label">上级组织</span>
                    <select
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                      className="input-shell"
                    >
                      {roots.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <Button onClick={() => void create()} disabled={!name.trim()}>
                  <Plus className="h-4 w-4" />
                  创建
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={level === 'members' ? 'md:col-span-12' : 'md:col-span-7'}>
          <CardHeader>
            <CardTitle>
              {level === 'committee' && '党委列表'}
              {level === 'branch' && '党支部列表'}
              {level === 'members' && '组织成员'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {level === 'committee' && (
              <div className="grid gap-2">
                {roots.map((r) => {
                  const branchCount = items.filter((x) => x.parentId === r.id).length
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl bg-white/90 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[#12151c]">{r.name}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {branchCount} 个党支部 · 挂靠人员 {r.stats.memberCount}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/admin/org/${r.id}/members`}>
                            <Button variant="secondary" className="px-3 text-xs">
                              <Users className="h-3.5 w-3.5" />
                              查看人员
                            </Button>
                          </Link>
                          <Link to={`/admin/org/${r.id}`}>
                            <Button className="px-3 text-xs">
                              查看党支部
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {roots.length === 0 && <div className="py-10 text-sm text-zinc-400">暂无党委</div>}
              </div>
            )}

            {level === 'branch' && current && (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[rgba(158,27,43,0.04)] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(158,27,43,0.1)]">
                  <div>
                    <div className="text-sm font-medium text-[#12151c]">{current.name} 挂靠人员</div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      直属本党委的人员（不含下级支部）· 共 {current.stats.memberCount} 人
                    </div>
                  </div>
                  <Link to={`/admin/org/${current.id}/members`}>
                    <Button variant="secondary" className="px-3 text-xs">
                      <Users className="h-3.5 w-3.5" />
                      查看人员
                    </Button>
                  </Link>
                </div>

                <div className="grid gap-2">
                  {children.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl bg-white/90 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Link to={`/admin/org/${c.id}`} className="group min-w-0 flex-1">
                          <div className="text-sm font-medium text-[#12151c] group-hover:text-[#9e1b2b]">
                            {c.name}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            成员 {c.stats.memberCount} · 任务 {c.stats.taskCount} · 完成率{' '}
                            {c.stats.completionRate}% · 均分 {c.stats.avgExamScore}
                          </div>
                        </Link>
                        <div className="flex items-center gap-2">
                          <Link to={`/admin/org/${c.id}`}>
                            <Button variant="secondary" className="px-3 text-xs">
                              查看人员
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button variant="danger" className="px-3" onClick={() => void remove(c.id)}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {children.length === 0 && (
                    <div className="py-10 text-sm text-zinc-400">暂无党支部，可在左侧新建</div>
                  )}
                </div>
              </div>
            )}

            {level === 'members' && current && (
              <div className="grid gap-4">
                <div className="grid gap-2 md:grid-cols-4">
                  {[
                    ['成员数', `${current.stats.memberCount}`],
                    ['任务数', `${current.stats.taskCount}`],
                    ['完成率', `${current.stats.completionRate}%`],
                    ['测验均分', `${current.stats.avgExamScore}`],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl bg-[#9e1b2b]/5 px-3 py-3 shadow-[inset_0_0_0_1px_rgba(140,36,36,0.08)]"
                    >
                      <div className="text-xs font-medium text-[#9e1b2b]/60">{label}</div>
                      <div className="mt-2 text-lg font-bold tracking-[-0.04em] text-[#12151c]">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link to={`/admin/users?orgUnitId=${encodeURIComponent(current.id)}`}>
                    <Button variant="secondary">
                      <Users className="h-4 w-4" />
                      在人员管理中查看
                    </Button>
                  </Link>
                  {!isCommitteeMembers && (
                    <Button variant="danger" onClick={() => void remove(current.id)}>
                      <Trash className="h-4 w-4" />
                      删除本支部
                    </Button>
                  )}
                  {isCommitteeMembers && (
                    <Link to={`/admin/org/${current.id}`}>
                      <Button variant="secondary">
                        查看党支部
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>

                <div className="grid gap-2">
                  {current.members.map((member) => (
                    <Link
                      key={member.id}
                      to={`/admin/users?orgUnitId=${encodeURIComponent(current.id)}&userId=${encodeURIComponent(member.id)}`}
                      className="group flex items-center justify-between gap-3 rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition hover:bg-[rgba(158,27,43,0.05)]"
                    >
                      <div>
                        <div className="text-sm font-medium text-[#12151c] group-hover:text-[#9e1b2b]">
                          {member.name}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {roleLabels[member.role] ?? member.role}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#9e1b2b]">
                        查看详情
                        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  ))}
                  {current.members.length === 0 && (
                    <div className="py-10 text-center text-sm text-zinc-400">
                      暂无成员
                      <div className="mt-3">
                        <Link to={`/admin/users?orgUnitId=${encodeURIComponent(current.id)}`}>
                          <Button variant="secondary">去人员管理添加</Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
