import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  BranchScoresSection,
  type BranchExamScore,
  type BranchScoresSummary,
} from '@/components/BranchScoresSection'
import './index.scss'

type Dash = {
  orgName: string
  summary: {
    memberCount: number
    durationHours: number
    avgDurationHours?: number
    overallTaskCompletionRate: number
    avgExamScore: number
    passRate: number
  }
  tasks: Array<{
    id: string
    title: string
    completionRate: number
    completedMemberCount: number
    pendingMembers?: Array<{ name: string }>
  }>
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState<Dash | null>(null)
  const [scores, setScores] = useState<BranchScoresSummary | null>(null)
  const [exams, setExams] = useState<BranchExamScore[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'secretary' && user.role !== 'admin') {
      Taro.redirectTo({ url: '/pages/home/index' })
    }
  }, [user])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [dash, memberScores, branchExams] = await Promise.all([
        apiFetch<Dash>('/api/stats/branch-dashboard'),
        apiFetch<BranchScoresSummary>('/api/stats/member-scores'),
        apiFetch<{ exams: BranchExamScore[] }>('/api/stats/branch-exams'),
      ])
      setData(dash)
      setScores(memberScores)
      setExams(branchExams.exams ?? [])
    } catch (e: any) {
      setError(e?.message ?? '内容加载失败，请您稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const s = data?.summary

  return (
    <PageShell tabPath="/pages/dashboard/index">
      <View className="dash-head">
        <View>
          <Text className="m-title">支部看板</Text>
          <Text className="m-sub">{data?.orgName ?? '本支部数据'}</Text>
        </View>
        <Button variant="ghost" className="dash-refresh" disabled={loading} onClick={() => void load()}>
          请刷新
        </Button>
      </View>
      {error && <View className="m-error">{error}</View>}

      {s && (
        <View className="dash-grid">
          {(
            [
              ['党员', s.memberCount],
              ['已参考', scores?.summary.attemptedMemberCount ?? '-'],
              ['总时长', `${s.durationHours}h`],
              ['人均', `${s.avgDurationHours ?? 0}h`],
              ['任务完成', `${s.overallTaskCompletionRate}%`],
              ['测验均分', scores?.summary.avgScore ?? s.avgExamScore],
              ['通过率', `${scores?.summary.passRate ?? s.passRate}%`],
            ] as const
          ).map(([k, v]) => (
            <View key={k} className="m-card dash-metric">
              <Text className="dash-metric__k">{k}</Text>
              <Text className="dash-metric__v">{v}</Text>
            </View>
          ))}
        </View>
      )}

      <Text className="m-section-title">任务完成</Text>
      <View className="dash-tasks">
        {(data?.tasks ?? []).map((t) => (
          <View key={t.id} className="m-card dash-task">
            <View className="dash-task__row">
              <Text className="dash-task__title">{t.title}</Text>
              <Text className="seal" style={{ fontWeight: 700 }}>
                {t.completionRate}%
              </Text>
            </View>
            <View className="dash-bar">
              <View
                className="dash-bar__fill"
                style={{ width: `${Math.min(100, t.completionRate)}%` }}
              />
            </View>
            {(t.pendingMembers?.length ?? 0) > 0 && (
              <Text className="dash-task__pending">
                未完成：{(t.pendingMembers ?? []).map((m) => m.name).join('、')}
              </Text>
            )}
          </View>
        ))}
        {(data?.tasks?.length ?? 0) === 0 && (
          <View className="m-empty">暂无任务，请您稍后再来查看</View>
        )}
      </View>

      <BranchScoresSection data={scores} exams={exams} />
    </PageShell>
  )
}
