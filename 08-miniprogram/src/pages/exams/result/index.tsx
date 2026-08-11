import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import './index.scss'

type Review = {
  examTitle: string
  totalScore: number
  passScore: number | null
  isPass: boolean
  createdAt: string
}

export default function ExamResultPage() {
  const router = useRouter()
  const attemptId = router.params.attemptId || ''
  const [data, setData] = useState<Review | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!attemptId) return
    void (async () => {
      try {
        setData(await apiFetch<Review>(`/api/exams/attempts/${attemptId}`))
      } catch (e: any) {
        setError(e?.message ?? '内容加载失败，请您稍后重试')
      }
    })()
  }, [attemptId])

  return (
    <PageShell>
      <Text className="m-title">成绩结果</Text>
      {error && <View className="m-error">{error}</View>}
      {data && (
        <View className="m-card result-card">
          <Text className="result-card__exam">{data.examTitle}</Text>
          <Text className={`result-card__score ${data.isPass ? 'ok' : 'seal'}`}>{data.totalScore}</Text>
          <Text className="result-card__meta">
            {data.isPass ? '通过' : '未通过'}
            {data.passScore != null ? ` · 及格线 ${data.passScore}` : ''}
          </Text>
          <Text className="result-card__time">{new Date(data.createdAt).toLocaleString()}</Text>
        </View>
      )}
      <View className="result-actions">
        <Button onClick={() => Taro.redirectTo({ url: '/pages/exams/index' })}>请返回测验</Button>
        <Button
          variant="secondary"
          onClick={() => Taro.redirectTo({ url: '/pages/wrong-book/index' })}
        >
          请查看错题本
        </Button>
      </View>
    </PageShell>
  )
}
