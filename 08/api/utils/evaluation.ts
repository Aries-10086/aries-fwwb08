/**
 * 党员综合评价口径（与 AI 报告一致）：
 * - 学习时长：最高 20 分（约 4 小时满额）
 * - 完成内容数：最高 20 分（约 4 篇满额）
 * - 测验均分：最高 60 分（均分 × 0.6）
 * 总分 0–100；等级：优秀 / 良好 / 合格 / 需加强
 */

export function scoreClamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function evaluationLevel(score: number): string {
  if (score >= 85) return '优秀'
  if (score >= 70) return '良好'
  if (score >= 55) return '合格'
  return '需加强'
}

export type EvaluationInput = {
  durationMs: number
  completedContentCount: number
  /** 测验均分；无成绩时按 0 */
  avgExamScore: number | null
}

export type EvaluationBreakdown = {
  score: number
  level: string
  parts: {
    duration: number
    completed: number
    exam: number
  }
  metrics: {
    durationHours: number
    completedCount: number
    avgExamScore: number
  }
}

export function computeEvaluation(input: EvaluationInput): EvaluationBreakdown {
  const durationHours = Number(input.durationMs ?? 0) / 3600000
  const completedCount = Math.max(0, Number(input.completedContentCount ?? 0))
  const avgExamScore = Math.max(0, Number(input.avgExamScore ?? 0))

  const durationPart = scoreClamp(Math.min(20, durationHours * 5))
  const completedPart = scoreClamp(Math.min(20, completedCount * 5))
  const examPart = scoreClamp(Math.min(60, avgExamScore * 0.6))
  const score = scoreClamp(durationPart + completedPart + examPart)

  return {
    score,
    level: evaluationLevel(score),
    parts: {
      duration: durationPart,
      completed: completedPart,
      exam: examPart,
    },
    metrics: {
      durationHours: Math.round(durationHours * 10) / 10,
      completedCount,
      avgExamScore: Math.round(avgExamScore),
    },
  }
}

export type RankedMember = {
  userId: string
  name: string
  username: string
  orgUnitId: string
  orgName?: string
  rank: number
  score: number
  level: string
  durationHours: number
  completedContentCount: number
  avgExamScore: number | null
  attemptCount: number
}

/** 按综合分降序赋名次（同分并列，下一名跳过） */
export function assignRanks<T extends { score: number }>(
  items: T[],
): Array<T & { rank: number }> {
  const sorted = [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return 0
  })
  let lastScore: number | null = null
  let lastRank = 0
  return sorted.map((item, index) => {
    if (lastScore === null || item.score !== lastScore) {
      lastRank = index + 1
      lastScore = item.score
    }
    return { ...item, rank: lastRank }
  })
}
