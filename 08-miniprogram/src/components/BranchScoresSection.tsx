import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import './BranchScoresSection.scss'

export type BranchMemberScore = {
  userId: string
  name: string
  evalRank?: number | null
  evalScore?: number
  avgScore: number | null
  attemptCount: number
}

export type BranchExamScore = {
  examId: string
  title: string
  attemptedCount: number
  memberCount: number
  notAttempted: Array<{ name: string }>
  avgScore: number
}

export type BranchScoresSummary = {
  orgName: string
  summary: {
    memberCount: number
    attemptedMemberCount: number
    avgScore: number
    passRate: number
  }
  members: BranchMemberScore[]
}

type Props = {
  data: BranchScoresSummary | null
  exams: BranchExamScore[]
}

export function BranchScoresSection({ data, exams }: Props) {
  const [tab, setTab] = useState<'rank' | 'exams'>('rank')

  if (!data) return null

  return (
    <View className="branch-scores">
      <Text className="m-section-title">支部成绩</Text>

      <View className="branch-scores__tabs">
        <View
          className={`branch-scores__tab ${tab === 'rank' ? 'is-on' : ''}`}
          onClick={() => setTab('rank')}
        >
          <Text>综合排行</Text>
        </View>
        <View
          className={`branch-scores__tab ${tab === 'exams' ? 'is-on' : ''}`}
          onClick={() => setTab('exams')}
        >
          <Text>各次测验</Text>
        </View>
      </View>

      {tab === 'rank' && (
        <View className="branch-scores__list">
          {(data.members ?? []).map((m) => (
            <View key={m.userId} className="m-card branch-scores__member">
              <View className="branch-scores__rank">
                <Text>{m.evalRank ?? '-'}</Text>
              </View>
              <View className="branch-scores__member-main">
                <Text className="branch-scores__member-name">{m.name}</Text>
                <Text className="branch-scores__member-meta">
                  综合 {m.evalScore ?? 0} · 均分 {m.avgScore ?? '-'} / {m.attemptCount} 次
                </Text>
              </View>
            </View>
          ))}
          {data.members.length === 0 && (
            <View className="m-empty">暂无排行数据，请您稍后再来查看</View>
          )}
        </View>
      )}

      {tab === 'exams' && (
        <View className="branch-scores__list">
          {exams.map((e) => (
            <View key={e.examId} className="m-card branch-scores__exam">
              <Text className="branch-scores__exam-title">{e.title}</Text>
              <Text className="branch-scores__exam-meta">
                参考 {e.attemptedCount}/{e.memberCount} · 均分 {e.avgScore}
              </Text>
              {e.notAttempted.length > 0 && (
                <View className="branch-scores__miss">
                  <Text>未参与：{e.notAttempted.map((m) => m.name).join('、')}</Text>
                </View>
              )}
            </View>
          ))}
          {exams.length === 0 && (
            <View className="m-empty">暂无测验记录，请您稍后再来查看</View>
          )}
        </View>
      )}
    </View>
  )
}
