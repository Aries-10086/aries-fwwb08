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
  GraduationCap,
  Sparkles,
  BarChart3,
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
] as const

const secretaryNav = [
  { to: '/m/scores', label: '支部成绩', icon: BarChart3 },
  { to: '/m/home', label: '学习', icon: BookOpen },
  { to: '/m/exams', label: '测验', icon: ClipboardList },
  { to: '/m/report', label: 'AI 报告', icon: Sparkles },
] as const

const memberNav = [
  { to: '/m/home', label: '学习', icon: BookOpen },
  { to: '/m/exams', label: '测验', icon: ClipboardList },
  { to: '/m/report', label: 'AI 报告', icon: Sparkles },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const nav =
    user?.role === 'admin' ? adminNav : user?.role === 'secretary' ? secretaryNav : user ? memberNav : []
  const roleName =
    user?.role === 'admin' ? '管理中枢' : user?.role === 'secretary' ? '支部端' : user ? '党员端' : '访客入口'

  return (
    <div className="min-h-screen text-[#171717]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-0 h-[620px] w-[1040px] -translate-x-1/2 rounded-full bg-[#b91c1c]/12 blur-3xl" />
        <div className="absolute -bottom-36 left-[-12%] h-[520px] w-[720px] rounded-full bg-[#8c2424]/10 blur-3xl" />
        <div className="absolute right-[-8%] top-36 h-[480px] w-[620px] rounded-full bg-[#ef4444]/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-black/5 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 rounded-[28px] bg-[#b91c1c] px-6 py-5 text-white shadow-[0_18px_48px_rgba(185,28,28,0.18)]">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(145deg,#b91c1c_0%,#8c2424_52%,#450a0a_100%)] text-white shadow-[0_18px_40px_rgba(140,36,36,0.18)]">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-[0.34em] text-white/75">Smart Party School</div>
              <div className="font-[800] tracking-[-0.04em] text-white">数智党校学习系统</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden items-center gap-3 rounded-full bg-white/15 px-4 py-2 text-sm text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] md:flex">
                <span className="h-2 w-2 rounded-full bg-white" />
                <span className="font-medium">{user.name}</span>
                <span className="text-white/45">/</span>
                <span className="text-white/70">{roleName}</span>
              </div>
            )}
            {user ? (
              <Button variant="ghost" onClick={() => logout()} className="px-3">
                <LogOut className="h-4 w-4" />
                退出
              </Button>
            ) : null}
          </div>
        </div>

        {user && nav.length > 0 && (
          <div className="mx-auto max-w-7xl px-6 pb-5">
            <nav className="flex flex-wrap gap-2 rounded-[24px] bg-white/70 p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
              {nav.map((it) => {
                const active = location.pathname.startsWith(it.to)
                const Icon = it.icon
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition',
                      active
                        ? 'bg-[linear-gradient(135deg,#b91c1c_0%,#8c2424_55%,#450a0a_100%)] text-white shadow-[0_16px_26px_rgba(140,36,36,0.18)]'
                        : 'bg-transparent text-black/70 hover:bg-[rgba(140,36,36,0.06)] hover:text-[#8c2424]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {it.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      <main className="relative z-10 mx-auto max-w-7xl bg-white px-6 py-8 md:py-10">{children}</main>
    </div>
  )
}
