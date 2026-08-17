import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlass, Buildings, User } from '@phosphor-icons/react'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

type Org = { id: string; name: string; parentId: string | null }
type Person = { id: string; name: string; username: string; role: string; orgUnitId: string }

export function GlobalSearch() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [orgs, setOrgs] = useState<Org[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loaded, setLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user?.role !== 'admin') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [user?.role])

  useEffect(() => {
    if (!open || loaded || user?.role !== 'admin') return
    void (async () => {
      try {
        const [o, u] = await Promise.all([
          apiFetch<Org[]>('/api/org-units'),
          apiFetch<Person[]>('/api/users'),
        ])
        setOrgs(o)
        setPeople(u)
        setLoaded(true)
      } catch {
        /* ignore */
      }
    })()
  }, [open, loaded, user?.role])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const key = q.trim().toLowerCase()
  const orgHits = useMemo(() => {
    if (!key) return []
    return orgs.filter((o) => o.name.toLowerCase().includes(key)).slice(0, 6)
  }, [orgs, key])
  const peopleHits = useMemo(() => {
    if (!key) return []
    return people
      .filter(
        (p) =>
          p.name.toLowerCase().includes(key) ||
          p.username.toLowerCase().includes(key),
      )
      .slice(0, 8)
  }, [people, key])

  if (user?.role !== 'admin') return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="site-search hidden lg:flex"
      >
        <span className="flex flex-1 items-center px-3 text-left text-[13px] text-[rgba(18,21,28,0.4)]">
          搜组织 / 人员
        </span>
        <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#9e1b2b] text-white">
          <MagnifyingGlass size={14} />
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[180] flex items-start justify-center bg-black/25 px-4 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden border border-[#e8ecf1] bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
              <MagnifyingGlass className="text-[rgba(18,21,28,0.35)]" size={18} />
              <input
                ref={inputRef}
                className="w-full bg-transparent text-sm outline-none"
                placeholder="搜索党委、支部、姓名或账号…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {!key && (
                <div className="px-3 py-8 text-center text-sm text-[rgba(18,21,28,0.4)]">
                  输入关键词，减少层层点选
                </div>
              )}
              {key && orgHits.length === 0 && peopleHits.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-[rgba(18,21,28,0.4)]">无匹配结果</div>
              )}
              {orgHits.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1 text-[11px] font-medium text-[rgba(18,21,28,0.4)]">组织</div>
                  {orgHits.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[rgba(158,27,43,0.06)]',
                      )}
                      onClick={() => {
                        setOpen(false)
                        setQ('')
                        nav(o.parentId ? `/admin/org/${o.id}` : `/admin/org/${o.id}`)
                      }}
                    >
                      <Buildings className="h-4 w-4 text-[#9e1b2b]" />
                      <span className="font-medium">{o.name}</span>
                      <span className="text-xs text-[rgba(18,21,28,0.4)]">
                        {o.parentId ? '党支部' : '党委'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {peopleHits.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-medium text-[rgba(18,21,28,0.4)]">人员</div>
                  {peopleHits.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[rgba(158,27,43,0.06)]"
                      onClick={() => {
                        setOpen(false)
                        setQ('')
                        nav(`/admin/users?userId=${encodeURIComponent(p.id)}&orgUnitId=${encodeURIComponent(p.orgUnitId)}`)
                      }}
                    >
                      <User className="h-4 w-4 text-[#9e1b2b]" />
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-[rgba(18,21,28,0.4)]">@{p.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
