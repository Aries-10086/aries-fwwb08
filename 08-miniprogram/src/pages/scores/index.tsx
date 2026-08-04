import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import './index.scss'

type Member = {
  userId: string
  name: string
  evalRank?: number | null
  evalScore?: number
  avgScore: number | null
  attemptCount: number
  latestScore: number | null
  latestIsPass: boolean | null
}

type ScoresData = {
  orgName: string
  summary: { memberCount: number; attemptedMemberCount: number; avgScore: number; passRate: number }
  members: Member[]
}

type ExamRow = {
  examId: string
  title: string
  attemptedCount: number
  memberCount: number
  notAttempted: Array<{ name: string }>
  avgScore: number
}

export default function ScoresPage() {
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState<ScoresData | null>(null)
  const [exams, setExams] = useState<ExamRow[]>([])
  const [tab, setTab] = useState<'rank' | 'exams'>('rank')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user && user.role !== 'secretary' && user.role !== 'admin') {
      Taro.redirectTo({ url: '/pages/home/index' })
    }
  }, [user])

  useEffect(() => {
    void (async () => {
      try {
        const [scores, branchExams] = await Promise.all([
          apiFetch<ScoresData>('/api/stats/member-scores'),
          apiFetch<{ exams: ExamRow[] }>('/api/stats/branch-exams'),
        ])
        setData(scores)
        setExams(branchExams.exams ?? [])
      } catch (e: any) {
        setError(e?.message ?? '加载失败')
      }
    })()
  }, [])

  return (
    <PageShell tabPath="/pages/scores/index">
      <Text className="m-title">支部成绩</Text>
      <Text className="m-sub">{data?.orgName ?? ''}</Text>
      {error && <View className="m-error">{error}</View>}

      {data && (
        <View className="scores-grid">
          {[
            ['党员', data.summary.memberCount],
            ['已参考', data.summary.attemptedMemberCount],
            ['均分', data.summary.avgScore],
            ['通过率', `${data.summary.passRate}%`],
          ].map(([k, v]) => (
            <View key={String(k)} className="m-card scores-metric">
              <Text className="scores-metric__k">{k}</Text>
              <Text className="scores-metric__v">{v}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="scores-tabs">
        <View
          className={`scores-tab ${tab === 'rank' ? 'is-on' : ''}`}
          onClick={() => setTab('rank')}
        >
          <Text>综合排行</Text>
        </View>
        <View
          className={`scores-tab ${tab === 'exams' ? 'is-on' : ''}`}
          onClick={() => setTab('exams')}
        >
          <Text>各次测验</Text>
        </View>
      </View>

      {tab === 'rank' && (
        <View className="scores-list">
          {(data?.members ?? []).map((m) => (
            <View key={m.userId} className="m-card scores-member">
              <View className="scores-rank">
                <Text>{m.evalRank ?? '-'}</Text>
              </View>
              <View className="scores-member__main">
                <Text className="scores-member__name">{m.name}</Text>
                <Text className="scores-member__meta">
                  综合 {m.evalScore ?? 0} · 均分 {m.avgScore ?? '-'} / {m.attemptCount} 次
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {tab === 'exams' && (
        <View className="scores-list">
          {exams.map((e) => (
            <View key={e.examId} className="m-card scores-exam">
              <Text className="scores-exam__title">{e.title}</Text>
              <Text className="scores-exam__meta">
                参考 {e.attemptedCount}/{e.memberCount} · 均分 {e.avgScore}
              </Text>
              {e.notAttempted.length > 0 && (
                <View className="scores-miss">
                  <Text>未参与：{e.notAttempted.map((m) => m.name).join('、')}</Text>
                </View>
              )}
            </View>
          ))}
          {exams.length === 0 && <View className="m-empty">暂无测验</View>}
        </View>
      )}
    </PageShell>
  )
}
