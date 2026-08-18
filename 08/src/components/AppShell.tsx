import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { GlobalSearch } from '@/components/GlobalSearch'
import { Button } from '@/components/Button'
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react'

type NavLink = { to: string; label: string }
type NavItem = NavLink | { label: string; children: NavLink[] }

const adminNav: NavItem[] = [
  { to: '/admin/dashboard', label: '看板' },
  { to: '/admin/org', label: '组织' },
  { to: '/admin/users', label: '人员' },
  { to: '/admin/contents', label: '内容' },
  { to: '/admin/tasks', label: '任务' },
  { to: '/admin/questions', label: '题库' },
  { to: '/admin/papers', label: '试卷' },
  { to: '/admin/exams', label: '测验' },
  {
    label: 'AI',
    children: [
      { to: '/admin/ai-query', label: '查询' },
      { to: '/admin/ai-settings', label: '设置' },
      { to: '/admin/ai-logs', label: '日志' },
      { to: '/admin/chat', label: '助手' },
    ],
  },
  { to: '/account', label: '我的' },
]

const secretaryNav: NavItem[] = [
  { to: '/m/dashboard', label: '支部看板' },
  { to: '/m/members', label: '人员' },
  { to: '/admin/tasks', label: '任务' },
  { to: '/m/scores', label: '成绩' },
  { to: '/m/home', label: '学习' },
  { to: '/m/exams', label: '测验' },
  { to: '/m/wrong-book', label: '错题本' },
  {
    label: 'AI',
    children: [
      { to: '/m/report', label: '报告' },
      { to: '/m/chat', label: '助手' },
    ],
  },
  { to: '/account', label: '我的' },
]

const memberNav: NavItem[] = [
  { to: '/m/home', label: '学习' },
  { to: '/m/exams', label: '测验' },
  { to: '/m/wrong-book', label: '错题本' },
  {
    label: 'AI',
    children: [
      { to: '/m/report', label: '报告' },
      { to: '/m/chat', label: '助手' },
    ],
  },
  { to: '/account', label: '我的' },
]

function isGroup(item: NavItem): item is { label: string; children: NavLink[] } {
  return 'children' in item
}

function flatLinks(nav: NavItem[]): NavLink[] {
  return nav.flatMap((item) => (isGroup(item) ? item.children : [item]))
}

function crumbLabel(pathname: string, nav: NavItem[]) {
  const hit = flatLinks(nav)
    .sort((a, b) => b.to.length - a.to.length)
    .find((it) => pathname.startsWith(it.to))
  if (!hit) return '当前页'
  const group = nav.find((item) => isGroup(item) && item.children.some((c) => c.to === hit.to))
  return group && isGroup(group) ? `AI / ${hit.label}` : hit.label
}

function NavDropdown({ item, pathname }: { item: { label: string; children: NavLink[] }; pathname: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = item.children.some((c) => pathname.startsWith(c.to))

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={cn('mooc-nav', active && 'mooc-nav-active')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {item.label}
        <CaretDown size={12} className={cn('ml-0.5 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-[80] min-w-[132px] rounded-2xl bg-white p-1.5 shadow-[0_8px_28px_rgba(18,21,28,0.12)]"
        >
          {item.children.map((child) => {
            const childActive = pathname.startsWith(child.to)
            return (
              <Link
                key={child.to}
                to={child.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  'block rounded-xl px-3 py-2 text-sm text-[#555] hover:bg-[rgba(158,27,43,0.06)] hover:text-[#9e1b2b]',
                  childActive && 'bg-[rgba(158,27,43,0.08)] font-medium text-[#9e1b2b]',
                )}
              >
                {child.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MemberSearch() {
  const nav = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const urlQ = location.pathname === '/m/home' ? (params.get('q') ?? '') : ''

  return (
    <form
      className="site-search hidden md:flex"
      onSubmit={(e) => {
        e.preventDefault()
        const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
        nav(q ? `/m/home?q=${encodeURIComponent(q)}` : '/m/home')
      }}
    >
      <input
        key={urlQ}
        name="q"
        defaultValue={urlQ}
        placeholder="搜索学习内容"
        aria-label="搜索学习内容"
      />
      <button type="submit" aria-label="搜索">
        <MagnifyingGlass size={14} />
      </button>
    </form>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const nav =
    user?.role === 'admin' ? adminNav : user?.role === 'secretary' ? secretaryNav : user ? memberNav : []
  const isHome = location.pathname === '/'
  const isPublic = !user

  return (
    <div className={cn(isPublic ? 'min-h-[100dvh] text-[#12151c]' : 'flex min-h-[100dvh] flex-col bg-[#f4f6f8] text-[#12151c]')}>
      <a href="#main-content" className="skip-link">
        跳到主要内容
      </a>

      {isPublic ? (
        <header className="sticky top-0 z-[40] border-b border-[rgba(18,21,28,0.06)] bg-[rgba(244,246,248,0.88)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
            <Link to="/" className="group flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#9e1b2b] text-white shadow-[0_6px_16px_rgba(158,27,43,0.22)] transition group-hover:bg-[#861625]">
                <span className="text-lg font-bold leading-none">校</span>
              </div>
              <div className="leading-tight">
                <div className="brand-mark text-2xl text-[#12151c] md:text-3xl">数智党校</div>
                <div className="hidden text-xs text-[rgba(18,21,28,0.42)] sm:block">学习 · 治理 · 洞察</div>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center rounded-[10px] bg-[#9e1b2b] px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(158,27,43,0.2),0_6px_16px_rgba(158,27,43,0.18)] transition hover:bg-[#861625]"
              >
                注册
              </Link>
              {!isHome && (
                <Link to="/login">
                  <Button className="px-4 py-2 text-xs">登录</Button>
                </Link>
              )}
            </div>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-[40] bg-white/95 backdrop-blur-md">
          <div className="bg-[#fafafa]">
            <div className="mx-auto flex h-9 max-w-[1200px] items-center justify-between px-5 text-[12px] text-[#9aa0a6]">
              <span>数智党校学习系统 · 组织内部在线学习平台</span>
              <div className="flex items-center gap-1">
                <Link to="/account" className="rounded-full px-2.5 py-1 hover:bg-white hover:text-[#9e1b2b]">
                  个人中心
                </Link>
                <span className="text-[#ddd]">|</span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="rounded-full px-2.5 py-1 hover:bg-white hover:text-[#9e1b2b]"
                >
                  退出
                </button>
              </div>
            </div>
          </div>

          <div className="relative z-20 bg-white shadow-[0_1px_0_rgba(18,21,28,0.04)]">
            <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-6 overflow-visible px-5">
              <Link to="/" className="flex shrink-0 items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#9e1b2b] text-sm font-bold text-white">
                  校
                </div>
                <span className="text-[20px] font-semibold leading-none tracking-tight text-[#12151c]">数智党校</span>
              </Link>

              <nav aria-label="功能导航" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-visible">
                {nav.map((it) =>
                  isGroup(it) ? (
                    <NavDropdown key={it.label} item={it} pathname={location.pathname} />
                  ) : (
                    <Link
                      key={it.to}
                      to={it.to}
                      className={cn('mooc-nav shrink-0', location.pathname.startsWith(it.to) && 'mooc-nav-active')}
                      aria-current={location.pathname.startsWith(it.to) ? 'page' : undefined}
                    >
                      {it.label}
                    </Link>
                  ),
                )}
              </nav>

              <div className="flex shrink-0 items-center gap-4">
                {user.role === 'admin' ? <GlobalSearch /> : <MemberSearch />}
                <Link to="/account" className="hidden items-center gap-2 text-sm text-[#555] hover:text-[#9e1b2b] lg:flex">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f3f4f6] text-xs text-[#9e1b2b]">
                    {user.name.slice(0, 1)}
                  </span>
                  Hi, {user.name}
                </Link>
              </div>
            </div>
          </div>

          <div className="relative z-0 bg-[#f4f6f8]">
            <div className="mx-auto flex h-11 max-w-[1200px] items-center px-5 text-[13px] text-[#9aa0a6]">
              <Link to="/" className="hover:text-[#9e1b2b]">
                首页
              </Link>
              <span className="mx-2 text-[#d0d4da]">›</span>
              <span className="text-[#666]">{crumbLabel(location.pathname, nav)}</span>
            </div>
          </div>
        </header>
      )}

      <main
        id="main-content"
        className={cn(
          'relative z-10 flex-1',
          isHome ? 'mx-auto max-w-none px-0 py-0' : isPublic ? 'mx-auto max-w-7xl px-6 py-8 md:py-10' : 'mx-auto w-full max-w-[1200px] px-4 py-6',
        )}
      >
        {children}
      </main>
    </div>
  )
}
