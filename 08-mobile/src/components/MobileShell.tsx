import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
  BookBookmark,
  BookOpen,
  ChartBar,
  ClipboardText,
  Sparkle,
  SquaresFour,
  User,
} from '@phosphor-icons/react'

const memberTabs = [
  { to: '/home', label: '学习', icon: BookOpen },
  { to: '/exams', label: '测验', icon: ClipboardText },
  { to: '/wrong-book', label: '错题', icon: BookBookmark },
  { to: '/report', label: '报告', icon: Sparkle },
  { to: '/account', label: '我的', icon: User },
] as const

const secretaryTabs = [
  { to: '/dashboard', label: '看板', icon: SquaresFour },
  { to: '/home', label: '学习', icon: BookOpen },
  { to: '/exams', label: '测验', icon: ClipboardText },
  { to: '/scores', label: '成绩', icon: ChartBar },
  { to: '/account', label: '我的', icon: User },
] as const

const immersive = [/^\/exam\//, /^\/content\//]

export function MobileShell() {
  const { user } = useAuthStore()
  const loc = useLocation()
  const nav = useNavigate()
  const tabs = user?.role === 'secretary' ? secretaryTabs : memberTabs
  const hideTab = immersive.some((re) => re.test(loc.pathname))

  useEffect(() => {
    if (!user) nav('/login', { replace: true })
    else if (user.role === 'admin') nav('/admin-tip', { replace: true })
  }, [user, nav])

  if (!user || user.role === 'admin') return null

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-paper shadow-[0_0_0_1px_rgba(18,21,28,0.06)] md:my-4 md:min-h-[calc(100dvh-2rem)] md:rounded-[28px] md:overflow-hidden">
      <main className={cn('flex-1 overflow-y-auto', !hideTab && 'pb-tab')}>
        <Outlet />
      </main>

      {!hideTab && (
        <nav
          className="sticky bottom-0 z-40 grid border-t border-black/5 bg-white/95 backdrop-blur-xl"
          style={{
            gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
            paddingBottom: 'var(--safe-bottom)',
          }}
          aria-label="底部导航"
        >
          {tabs.map((t) => {
            const active = loc.pathname === t.to || loc.pathname.startsWith(`${t.to}/`)
            const Icon = t.icon
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  active ? 'text-seal' : 'text-ink/40',
                )}
              >
                <Icon size={22} weight={active ? 'fill' : 'regular'} />
                {t.label}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
