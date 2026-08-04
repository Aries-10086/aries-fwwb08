import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import './index.scss'

type Exam = {
  id: string
  title: string
  durationMin: number
  passScore: number
  remainingAttempts: number
  canAttempt: boolean
  bestScore: number | null
}

type HistoryItem = {
  id: string
  examTitle: string
  totalScore: number
  isPass: boolean
  createdAt: string
}

export default function ExamsPage() {
  const [items, setItems] = useState<Exam[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [exams, hist] = await Promise.all([
          apiFetch<Exam[]>('/api/exams'),
          apiFetch<HistoryItem[]>('/api/exams/attempts/mine'),
        ])
        setItems(exams)
        setHistory(hist)
      } catch (e: any) {
        setError(e?.message ?? '加载失败')
      }
    })()
  }, [])

  return (
    <PageShell tabPath="/pages/exams/index">
      <Text className="m-title">测验</Text>
      <Text className="m-sub">本支部已发布的测验</Text>
      {error && <View className="m-error">{error}</View>}

      <View className="exam-list">
        {items.map((x) => (
          <View key={x.id} className="m-card exam-card">
            <Text className="exam-card__title">{x.title}</Text>
            <Text className="exam-card__meta">
              {x.durationMin} 分钟 · 及格 {x.passScore} · 剩余 {x.remainingAttempts} 次
              {x.bestScore != null ? ` · 最好 ${x.bestScore}` : ''}
            </Text>
            <View className="exam-card__action">
              {x.canAttempt ? (
                <Button
                  onClick={() =>
                    Taro.navigateTo({ url: `/pages/exams/take/index?examId=${x.id}` })
                  }
                >
                  开始作答
                </Button>
              ) : (
                <Button disabled>次数已用尽</Button>
              )}
            </View>
          </View>
        ))}
        {items.length === 0 && <View className="m-empty">暂无可参与测验</View>}
      </View>

      <Text className="m-section-title">我的成绩</Text>
      <View className="exam-list">
        {history.slice(0, 10).map((h) => (
          <View
            key={h.id}
            className="m-card exam-hist"
            onClick={() =>
              Taro.navigateTo({ url: `/pages/exams/result/index?attemptId=${h.id}` })
            }
          >
            <View>
              <Text className="exam-card__title">{h.examTitle}</Text>
              <Text className="exam-card__meta">{new Date(h.createdAt).toLocaleString()}</Text>
            </View>
            <Text className={h.isPass ? 'ok score' : 'seal score'}>{h.totalScore} 分</Text>
          </View>
        ))}
        {history.length === 0 && <View className="m-empty">暂无成绩</View>}
      </View>
    </PageShell>
  )
}
