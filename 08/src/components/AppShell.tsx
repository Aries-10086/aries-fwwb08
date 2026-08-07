import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { GlobalSearch } from '@/components/GlobalSearch'
import { Button } from '@/components/Button'
import {
  SignOut,
  SquaresFour,
  Users,
  TreeStructure,
  BookOpen,
  BookBookmark,
  ClipboardText,
  FileText,
  Brain,
  ChartBar,
  Sparkle,
  User,
  ChatCircleDots,
  GearSix,
  ListChecks,
} from '@phosphor-icons/react'

const adminNav = [
  { to: '/admin/dashboard', label: '看板', icon: SquaresFour },
  { to: '/admin/org', label: '组织', icon: TreeStructure },
  { to: '/admin/users', label: '人员', icon: Users },
  { to: '/admin/contents', label: '内容', icon: BookOpen },
  { to: '/admin/tasks', label: '任务', icon: ClipboardText },
  { to: '/admin/questions', label: '题库', icon: FileText },
  { to: '/admin/papers', label: '试卷', icon: FileText },
  { to: '/admin/exams', label: '测验', icon: ClipboardText },
  { to: '/admin/ai-query', label: 'AI 查询', icon: Brain },
  { to: '/admin/ai-settings', label: 'AI 设置', icon: GearSix },
  { to: '/admin/ai-logs', label: 'AI 日志', icon: ListChecks },
  { to: '/admin/chat', label: 'AI 助手', icon: ChatCircleDots },
  { to: '/account', label: '我的', icon: User },
] as const

const secretaryNav = [
  { to: '/m/dashboard', label: '支部看板', icon: SquaresFour },
  { to: '/m/members', label: '人员', icon: Users },
  { to: '/admin/tasks', label: '任务', icon: ClipboardText },
  { to: '/m/scores', label: '成绩', icon: ChartBar },
  { to: '/m/home', label: '学习', icon: BookOpen },
  { to: '/m/exams', label: '测验', icon: ClipboardText },
  { to: '/m/wrong-book', label: '错题本', icon: BookBookmark },
  { to: '/m/report', label: 'AI 报告', icon: Sparkle },
  { to: '/m/chat', label: 'AI 助手', icon: ChatCircleDots },
  { to: '/account', label: '我的', icon: User },
] as const

const memberNav = [
  { to: '/m/home', label: '学习', icon: BookOpen },
  { to: '/m/exams', label: '测验', icon: ClipboardText },
  { to: '/m/wrong-book', label: '错题本', icon: BookBookmark },
  { to: '/m/report', label: 'AI 报告', icon: Sparkle },
  { to: '/m/chat', label: 'AI 助手', icon: ChatCircleDots },
  { to: '/account', label: '我的', icon: User },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const nav =
    user?.role === 'admin' ? adminNav : user?.role === 'secretary' ? secretaryNav : user ? memberNav : []
  const roleName =
    user?.role === 'admin' ? '管理中枢' : user?.role === 'secretary' ? '支部端' : user ? '党员端' : '访客入口'
  const isHome = location.pathname === '/'

  return (
    <div className="min-h-[100dvh] text-[#12151c]">
      <a href="#main-content" className="skip-link">
        跳到主要内容
      </a>

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
            <GlobalSearch />
            {user && (
              <div className="hidden items-center gap-2 rounded-full border border-[rgba(18,21,28,0.08)] bg-white px-3 py-1.5 text-sm shadow-[0_1px_2px_rgba(18,21,28,0.04)] md:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9e1b2b]" aria-hidden />
                <span className="font-medium">{user.name}</span>
                <span className="text-[rgba(18,21,28,0.22)]">/</span>
                <span className="text-[rgba(18,21,28,0.5)]">{roleName}</span>
              </div>
            )}
            {user ? (
              <Button variant="secondary" onClick={() => logout()} className="px-3 py-2 text-xs">
                <SignOut size={16} weight="bold" />
                退出
              </Button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>

        {user && nav.length > 0 && (
          <div className="mx-auto max-w-7xl px-6 pb-2.5">
            <nav aria-label="主导航" className="flex gap-1 overflow-x-auto border-t border-[rgba(18,21,28,0.06)] pt-2.5">
              {nav.map((it) => {
                const active = location.pathname.startsWith(it.to)
                const Icon = it.icon
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={cn('nav-link shrink-0', active && 'nav-link-active')}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon size={16} weight={active ? 'bold' : 'regular'} />
                    {it.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      <main
        id="main-content"
        className={cn(
          'relative z-10',
          isHome ? 'mx-auto max-w-none px-0 py-0' : 'mx-auto max-w-7xl px-6 py-8 md:py-10',
        )}
      >
        {children}
      </main>
    </div>
  )
}
