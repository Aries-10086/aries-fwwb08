import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import './index.scss'

type Report = {
  score: number
  level: string
  metrics: {
    durationHours: number
    completedCount: number
    avgExamScore: number
    passCount: number
  }
  ranking?: { branchRank: number | null; branchMemberCount: number | null }
  comment: string
}

export default function ReportPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const fromScores = router.params.from === 'scores'
  const isSecretary = user?.role === 'secretary' || user?.role === 'admin'
  const tabPath = fromScores && isSecretary ? '/pages/scores/index' : '/pages/report/index'
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Report>('/api/ai/report', {
        method: 'POST',
        body: JSON.stringify({ userId: user?.id }),
      })
      setReport(data)
    } catch (e: any) {
      setError(e?.message ?? '报告加载失败，请您稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <PageShell tabPath={tabPath}>
      {fromScores && isSecretary && (
        <Text className="report-back" onClick={() => Taro.navigateBack()}>
          ← 请返回学习服务
        </Text>
      )}
      <View className="report-head">
        <View>
          <Text className="m-title">AI 报告</Text>
          <Text className="m-sub">您的学习综合评价</Text>
        </View>
        <Button variant="ghost" className="report-refresh" disabled={loading} onClick={() => void load()}>
          请刷新
        </Button>
      </View>
      {error && <View className="m-error">{error}</View>}
      {report && (
        <>
          <View className="m-card report-score">
            <Text className="report-score__label">综合分</Text>
            <Text className="report-score__num seal">{report.score}</Text>
            <Text className="report-score__level">{report.level}</Text>
            {report.ranking?.branchRank != null && (
              <Text className="m-sub">
                支部排名 {report.ranking.branchRank}
                {report.ranking.branchMemberCount != null
                  ? ` / ${report.ranking.branchMemberCount}`
                  : ''}
              </Text>
            )}
          </View>
          <View className="report-metrics">
            {[
              ['学习时长', `${report.metrics.durationHours}h`],
              ['完成内容', `${report.metrics.completedCount}`],
              ['测验均分', `${report.metrics.avgExamScore}`],
              ['通过次数', `${report.metrics.passCount}`],
            ].map(([k, v]) => (
              <View key={k} className="m-card report-metric">
                <Text className="report-metric__k">{k}</Text>
                <Text className="report-metric__v">{v}</Text>
              </View>
            ))}
          </View>
          <View className="m-card report-comment">
            <Text className="report-comment__text">{report.comment}</Text>
          </View>
        </>
      )}
      {!report && !error && (
        <View className="m-empty">{loading ? '正在为您生成报告…' : '暂无报告，请您稍后再试'}</View>
      )}
    </PageShell>
  )
}
