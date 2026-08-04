import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAuthStore } from '@/store/auth'
import './TabBar.scss'

type TabItem = { path: string; label: string }

const memberTabs: TabItem[] = [
  { path: '/pages/home/index', label: '学习' },
  { path: '/pages/exams/index', label: '测验' },
  { path: '/pages/wrong-book/index', label: '错题' },
  { path: '/pages/report/index', label: '报告' },
  { path: '/pages/account/index', label: '我的' },
]

const secretaryTabs: TabItem[] = [
  { path: '/pages/dashboard/index', label: '看板' },
  { path: '/pages/home/index', label: '学习' },
  { path: '/pages/exams/index', label: '测验' },
  { path: '/pages/scores/index', label: '成绩' },
  { path: '/pages/account/index', label: '我的' },
]

type Props = {
  current: string
}

export function TabBar({ current }: Props) {
  const role = useAuthStore((s) => s.user?.role)
  const tabs = role === 'secretary' ? secretaryTabs : memberTabs

  return (
    <View className="mp-tabbar">
      {tabs.map((t) => {
        const active = current === t.path
        return (
          <View
            key={t.path}
            className={`mp-tabbar__item ${active ? 'is-active' : ''}`}
            onClick={() => {
              if (active) return
              Taro.redirectTo({ url: t.path })
            }}
          >
            <Text className="mp-tabbar__label">{t.label}</Text>
          </View>
        )
      })}
    </View>
  )
}
