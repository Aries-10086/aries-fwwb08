import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/Button'
import {
  LogOut,
  LayoutDashboard,
  Users,
  Network,
  BookOpen,
  ClipboardList,
  FileText,
  BrainCircuit,
  BarChart3,
  Sparkles,
  UserRound,
} from 'lucide-react'

const adminNav = [
  { to: '/admin/dashboard', label: '看板', icon: LayoutDashboard },
  { to: '/admin/org', label: '组织', icon: Network },
  { to: '/admin/users', label: '人员', icon: Users },
  { to: '/admin/contents', label: '内容', icon: BookOpen },
  { to: '/admin/tasks', label: '任务', icon: ClipboardList },
  { to: '/admin/questions', label: '题库', icon: FileText },
  { to: '/admin/papers', label: '试卷', icon: FileText },
  { to: '/admin/exams', label: '测验', icon: ClipboardList },
  { to: '/admin/ai-query', label: 'AI 查询', icon: BrainCircuit },
  { to: '/account', label: '我的', icon: UserRound },
] as const

const secretaryNav = [
  { to: '/m/dashboard', label: '支部看板', icon: LayoutDashboard },
  { to: '/m/scores', label: '支部成绩', icon: BarChart3 },
  { to: '/admin/tasks', label: '任务', icon: ClipboardList },
  { to: '/m/home', label: '学习', icon: BookOpen },
  { to: '/m/exams', label: '测验', icon: ClipboardList },
  { to: '/m/report', label: 'AI 报告', icon: Sparkles },
  { to: '/account', label: '我的', icon: UserRound },
] as const

const memberNav = [
  { to: '/m/home', label: '学习', icon: BookOpen },
  { to: '/m/exams', label: '测验', icon: ClipboardList },
  { to: '/m/report', label: 'AI 报告', icon: Sparkles },
  { to: '/account', label: '我的', icon: UserRound },
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
    <div className="min-h-screen text-[#0e1116]">
      <header className="relative z-20 border-b border-[rgba(14,17,22,0.08)] bg-[rgba(243,245,247,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="group flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center border border-[rgba(163,24,40,0.35)] bg-[#a31828] text-white shadow-[0_8px_20px_rgba(163,24,40,0.2)] transition group-hover:bg-[#8a1422]">
              <span className="font-display text-xl leading-none tracking-widest">校</span>
            </div>
            <div className="leading-tight">
              <div className="brand-mark text-xl text-[#0e1116] md:text-2xl">数智党校</div>
              <div className="text-[11px] tracking-[0.22em] text-[rgba(14,17,22,0.45)]">学习 · 治理 · 洞察</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden items-center gap-2 border border-[rgba(14,17,22,0.1)] bg-white/70 px-3 py-1.5 text-sm md:flex">
                <span className="h-1.5 w-1.5 bg-[#a31828]" />
                <span className="font-medium">{user.name}</span>
                <span className="text-[rgba(14,17,22,0.28)]">/</span>
                <span className="text-[rgba(14,17,22,0.55)]">{roleName}</span>
              </div>
            )}
            {user ? (
              <Button variant="secondary" onClick={() => logout()} className="px-3 py-2 text-xs">
                <LogOut className="h-4 w-4" />
                退出
              </Button>
            ) : (
              !isHome && (
                <Link to="/login">
                  <Button className="px-4 py-2 text-xs">登录</Button>
                </Link>
              )
            )}
          </div>
        </div>

        {user && nav.length > 0 && (
          <div className="mx-auto max-w-7xl px-6 pb-3">
            <nav className="flex flex-wrap gap-1 border-t border-[rgba(14,17,22,0.06)] pt-3">
              {nav.map((it) => {
                const active = location.pathname.startsWith(it.to)
                const Icon = it.icon
                return (
                  <Link key={it.to} to={it.to} className={cn('nav-link', active && 'nav-link-active')}>
                    <Icon className="h-4 w-4" />
                    {it.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      <main
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
