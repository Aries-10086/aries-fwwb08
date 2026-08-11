import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import './index.scss'

export default function ScoresHubPage() {
  const user = useAuthStore((s) => s.user)
  const [wrongCount, setWrongCount] = useState(0)

  useEffect(() => {
    if (user && user.role !== 'secretary' && user.role !== 'admin') {
      Taro.redirectTo({ url: '/pages/home/index' })
    }
  }, [user])

  useEffect(() => {
    void (async () => {
      try {
        const wrongBook = await apiFetch<{ totalCount: number }>('/api/exams/wrong-book/mine')
        setWrongCount(wrongBook.totalCount ?? 0)
      } catch {
        setWrongCount(0)
      }
    })()
  }, [])

  return (
    <PageShell tabPath="/pages/scores/index">
      <Text className="m-title">学习服务</Text>
      <Text className="m-sub">请您在此查看 AI 报告，或进入错题本巩固复习</Text>

      <View className="scores-hub">
        <View
          className="m-card scores-hub__card"
          onClick={() => Taro.navigateTo({ url: '/pages/report/index?from=scores' })}
        >
          <Text className="scores-hub__title">AI报告</Text>
          <Text className="scores-hub__desc">查看您的学习综合评价与改进建议</Text>
          <Text className="scores-hub__meta">点击查看最新报告</Text>
          <Text className="scores-hub__arrow seal">›</Text>
        </View>

        <View
          className="m-card scores-hub__card"
          onClick={() => Taro.navigateTo({ url: '/pages/wrong-book/index?from=scores' })}
        >
          <Text className="scores-hub__title">错题本</Text>
          <Text className="scores-hub__desc">请您重练历次测验错题，连续答对可移出</Text>
          <Text className="scores-hub__meta">共 {wrongCount} 题待巩固</Text>
          <Text className="scores-hub__arrow seal">›</Text>
        </View>
      </View>
    </PageShell>
  )
}
