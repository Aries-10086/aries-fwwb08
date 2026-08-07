/** NL 查询：时间槽 + 演示必中模板 */

import { buildTimeRange, type StatsRangeKey, type TimeRange } from './time-range.js'

export function parseTimeFromQuestion(q: string): TimeRange {
  if (/本月|这个月|当月/.test(q)) return buildTimeRange('month')
  if (/本季|本季度|这个季度/.test(q)) return buildTimeRange('quarter')
  if (/今年|本年|这一年|本年度/.test(q)) return buildTimeRange('year')
  return { key: 'all', label: '全部时间', from: null, to: null }
}

export type QueryTemplateHit = {
  metric: 'duration' | 'avg_score' | 'pass_rate' | 'completion_rate'
  wantMaxBranch?: boolean
  memberNameHint?: string | null
  label: string
}

/** 命中演示模板则返回结构化意图；未命中返回 null */
export function matchQueryTemplate(q: string): QueryTemplateHit | null {
  const s = q.trim()
  if (!s) return null

  // ⑤ / ① 完成率（含同义）
  if (/(完成率|学习完成|任务完成|学完比例|完成情况)/.test(s) && !/时长/.test(s)) {
    return { metric: 'completion_rate', label: '学习/任务完成率' }
  }
  // ② 均分最高（含同义）
  if (/(平均分|均分|平均成绩)/.test(s) && /(最高|第一|最好|排名第一|哪(个|一)支部)/.test(s)) {
    return { metric: 'avg_score', wantMaxBranch: true, label: '测验均分最高支部' }
  }
  if (/(平均分|均分|平均成绩)/.test(s)) {
    return { metric: 'avg_score', label: '测验平均分' }
  }
  // 通过率
  if (/通过率|及格率/.test(s)) {
    return { metric: 'pass_rate', label: '考试通过率' }
  }
  // ③ / ④ 时长（含「某某学习时长」）
  if (/学习时长|学时|学习时间|学了多久/.test(s)) {
    let hint: string | null = null
    const quoted = s.match(/党员[「"']([^」"']+)[」"']/)
    if (quoted?.[1]) hint = quoted[1]
    else if (/党员学习时长|党员的学习时长|党员学时/.test(s)) hint = '党员'
    else {
      const named = s.match(/党员([乙丙丁戊己庚辛])/)
      if (named?.[1]) hint = `党员${named[1]}`
      else {
        const before = s.match(/([^\s，。的「」"']{2,12})的?(?:学习时长|学时|学习时间)/)
        const cand = before?.[1]?.replace(/^(查|看|问|查询|今年|本月|本季)/, '') ?? null
        if (cand && !/支部|各|全体|党员/.test(cand)) hint = cand
      }
    }
    return {
      metric: 'duration',
      memberNameHint: hint,
      label: '学习时长',
    }
  }
  return null
}

export function rangeKeyFromQuestion(q: string): StatsRangeKey {
  return parseTimeFromQuestion(q).key
}
