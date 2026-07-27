/** 看板/统计用时间范围：本月 / 本季 / 今年 / 全部 */

export type StatsRangeKey = 'month' | 'quarter' | 'year' | 'all'

export type TimeRange = {
  key: StatsRangeKey
  label: string
  /** 含起点 */
  from: Date | null
  /** 不含终点 */
  to: Date | null
}

const LABELS: Record<StatsRangeKey, string> = {
  all: '全部时间',
  month: '本月',
  quarter: '本季',
  year: '今年',
}

export function parseStatsRange(raw: unknown): TimeRange {
  const key = String(raw ?? 'all').toLowerCase() as StatsRangeKey
  if (key === 'month' || key === 'quarter' || key === 'year') {
    return buildTimeRange(key)
  }
  return { key: 'all', label: LABELS.all, from: null, to: null }
}

export function buildTimeRange(key: Exclude<StatsRangeKey, 'all'>, now = new Date()): TimeRange {
  const y = now.getFullYear()
  const m = now.getMonth()
  if (key === 'month') {
    const from = new Date(y, m, 1)
    const to = new Date(y, m + 1, 1)
    return { key, label: LABELS.month, from, to }
  }
  if (key === 'quarter') {
    const qStart = Math.floor(m / 3) * 3
    const from = new Date(y, qStart, 1)
    const to = new Date(y, qStart + 3, 1)
    return { key, label: LABELS.quarter, from, to }
  }
  const from = new Date(y, 0, 1)
  const to = new Date(y + 1, 0, 1)
  return { key: 'year', label: LABELS.year, from, to }
}

/** SQL 片段：列在 [from, to) 内。参数从 startIdx 起追加 from/to ISO。 */
export function appendTimeFilter(
  columnSql: string,
  range: TimeRange,
  params: unknown[],
  startIdx = params.length + 1,
): { sql: string; nextIdx: number } {
  if (!range.from || !range.to) return { sql: '', nextIdx: startIdx }
  const fromIdx = startIdx
  const toIdx = startIdx + 1
  params.push(range.from.toISOString(), range.to.toISOString())
  return {
    sql: ` AND ${columnSql} >= $${fromIdx}::timestamptz AND ${columnSql} < $${toIdx}::timestamptz`,
    nextIdx: startIdx + 2,
  }
}
