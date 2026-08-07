import { Navigate } from 'react-router-dom'
import { useAuthStore, type UserRole } from '@/store/auth'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function RequireRole({
  roles,
  children,
  fallback = '/m/home',
}: {
  roles: UserRole[]
  children: React.ReactNode
  fallback?: string
}) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) {
    const to =
      user.role === 'admin' ? '/admin/dashboard' : user.role === 'secretary' ? '/m/dashboard' : fallback
    return <Navigate to={to} replace />
  }
  return <>{children}</>
}
