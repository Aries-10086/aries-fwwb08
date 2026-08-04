import { View } from '@tarojs/components'
import { PropsWithChildren, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useAuthStore } from '@/store/auth'
import { TabBar } from '@/components/TabBar'

type Props = PropsWithChildren<{
  tabPath?: string
  requireAuth?: boolean
  allowAdmin?: boolean
}>

export function PageShell({ children, tabPath, requireAuth = true, allowAdmin = false }: Props) {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!requireAuth) return
    if (!user) {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
    if (user.role === 'admin' && !allowAdmin) {
      Taro.redirectTo({ url: '/pages/admin-tip/index' })
    }
  }, [user, requireAuth, allowAdmin])

  if (requireAuth && (!user || (user.role === 'admin' && !allowAdmin))) {
    return null
  }

  return (
    <View className={tabPath ? 'm-page m-page--tab' : 'm-page'}>
      {children}
      {tabPath ? <TabBar current={tabPath} /> : null}
    </View>
  )
}
