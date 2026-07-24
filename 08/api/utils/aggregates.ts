import { query } from '../db.js'
import { toIso } from './json.js'

function placeholders(count: number, start = 1) {
  return Array.from({ length: count }, (_, index) => `$${start + index}`).join(',')
}

/** 批量加载用户已完成内容集合 */
export async function loadCompletedByUserIds(userIds: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>()
  for (const id of userIds) map.set(id, new Set())
  if (userIds.length === 0) return map

  const { rows } = await query(
    `SELECT user_id, content_id FROM learning_records
     WHERE is_completed = true AND user_id IN (${placeholders(userIds.length)})`,
    userIds,
  )

  for (const r of rows) {
    const uid = String(r.user_id)
    const set = map.get(uid) ?? new Set<string>()
    set.add(String(r.content_id))
    map.set(uid, set)
  }
  return map
}

/** 按组织批量加载党员（仅 role=member） */
export async function loadMemberIdsByOrg(orgUnitIds?: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  const { rows } = await query(
    orgUnitIds && orgUnitIds.length > 0
      ? `SELECT id, org_unit_id FROM users
         WHERE role = 'member' AND org_unit_id IN (${placeholders(orgUnitIds.length)})`
      : `SELECT id, org_unit_id FROM users WHERE role = 'member'`,
    orgUnitIds ?? [],
  )

  for (const r of rows) {
    const org = String(r.org_unit_id)
    const list = map.get(org) ?? []
    list.push(String(r.id))
    map.set(org, list)
  }
  return map
}

/** 批量加载各支部最新任务及其内容 ID */
export async function loadLatestTaskContentsByOrg(orgUnitIds?: string[]): Promise<Map<string, string[]>> {
  const { rows: latestTasks } = await query(
    `SELECT id, org_unit_id FROM (
       SELECT id, org_unit_id,
              ROW_NUMBER() OVER (PARTITION BY org_unit_id ORDER BY created_at DESC) AS rn
       FROM learning_tasks
       ${orgUnitIds && orgUnitIds.length > 0 ? `WHERE org_unit_id IN (${placeholders(orgUnitIds.length)})` : ''}
     ) ranked WHERE rn = 1`,
    orgUnitIds ?? [],
  )

  const taskIdByOrg = new Map<string, string>()
  const taskIds: string[] = []
  for (const r of latestTasks) {
    const org = String(r.org_unit_id)
    const tid = String(r.id)
    taskIdByOrg.set(org, tid)
    taskIds.push(tid)
  }

  const contentsByTask = await loadTaskContentsMap(taskIds)
  const result = new Map<string, string[]>()
  for (const [org, tid] of taskIdByOrg) {
    result.set(org, contentsByTask.get(tid) ?? [])
  }
  return result
}

/** 批量加载任务内容 ID */
export async function loadTaskContentsMap(taskIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  for (const id of taskIds) map.set(id, [])
  if (taskIds.length === 0) return map

  const { rows } = await query(
    `SELECT task_id, content_id FROM task_contents WHERE task_id IN (${placeholders(taskIds.length)})`,
    taskIds,
  )

  for (const r of rows) {
    const tid = String(r.task_id)
    const list = map.get(tid) ?? []
    list.push(String(r.content_id))
    map.set(tid, list)
  }
  return map
}

export function countMembersFullyDone(
  memberIds: string[],
  contentIds: string[],
  completedByUser: Map<string, Set<string>>,
): number {
  if (memberIds.length === 0 || contentIds.length === 0) return 0
  return memberIds.filter((uid) => {
    const done = completedByUser.get(uid) ?? new Set()
    return contentIds.every((cid) => done.has(cid))
  }).length
}

export function completionRatePercent(
  memberIds: string[],
  contentIds: string[],
  completedByUser: Map<string, Set<string>>,
): number {
  if (memberIds.length === 0) return 0
  if (contentIds.length === 0) return 0
  const done = countMembersFullyDone(memberIds, contentIds, completedByUser)
  return Math.round((done / memberIds.length) * 100)
}

export type ExamAgg = {
  attemptCount: number
  avgScore: number | null
  passCount: number
  passRate: number | null
  latestScore: number | null
  latestIsPass: boolean | null
  latestExamTitle: string | null
  latestAt: string | null
}

/** 批量聚合成员测验成绩（含最近一次） */
export async function loadExamAggByUserIds(userIds: string[]): Promise<Map<string, ExamAgg>> {
  const map = new Map<string, ExamAgg>()
  for (const id of userIds) {
    map.set(id, {
      attemptCount: 0,
      avgScore: null,
      passCount: 0,
      passRate: null,
      latestScore: null,
      latestIsPass: null,
      latestExamTitle: null,
      latestAt: null,
    })
  }
  if (userIds.length === 0) return map

  const userPlaceholders = placeholders(userIds.length)

  const { rows: aggRows } = await query(
    `SELECT user_id,
            COUNT(1) AS attempt_count,
            AVG(total_score) AS avg_score,
            SUM(CASE WHEN is_pass = true THEN 1 ELSE 0 END) AS pass_count
     FROM exam_attempts
     WHERE user_id IN (${userPlaceholders})
     GROUP BY user_id`,
    userIds,
  )

  for (const r of aggRows) {
    const uid = String(r.user_id)
    const attemptCount = Number(r.attempt_count ?? 0)
    const passCount = Number(r.pass_count ?? 0)
    map.set(uid, {
      attemptCount,
      avgScore: attemptCount > 0 ? Math.round(Number(r.avg_score ?? 0)) : null,
      passCount,
      passRate: attemptCount > 0 ? Math.round((passCount / attemptCount) * 100) : null,
      latestScore: null,
      latestIsPass: null,
      latestExamTitle: null,
      latestAt: null,
    })
  }

  const { rows: latestRows } = await query(
    `SELECT DISTINCT ON (ea.user_id)
            ea.user_id, ea.total_score, ea.is_pass, ea.created_at, e.title AS exam_title
     FROM exam_attempts ea
     LEFT JOIN exams e ON e.id = ea.exam_id
     WHERE ea.user_id IN (${userPlaceholders})
     ORDER BY ea.user_id, ea.created_at DESC, ea.id DESC`,
    userIds,
  )

  for (const r of latestRows) {
    const uid = String(r.user_id)
    const cur = map.get(uid)
    if (!cur) continue
    cur.latestScore = Number(r.total_score ?? 0)
    cur.latestIsPass = Boolean(r.is_pass)
    cur.latestExamTitle = r.exam_title ? String(r.exam_title) : null
    cur.latestAt = toIso(r.created_at)
  }

  return map
}

/** 批量加载学习时长 */
export async function loadDurationByUserIds(userIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for (const id of userIds) map.set(id, 0)
  if (userIds.length === 0) return map

  const { rows } = await query(
    `SELECT user_id, COALESCE(SUM(duration_ms), 0) AS s
     FROM learning_records
     WHERE user_id IN (${placeholders(userIds.length)})
     GROUP BY user_id`,
    userIds,
  )

  for (const r of rows) map.set(String(r.user_id), Number(r.s ?? 0))
  return map
}

/** 组织范围内考试汇总（一次查询） */
export async function loadOrgExamSummary(orgUnitId: string | null): Promise<{
  attemptCount: number
  avgExamScore: number
  passRate: number
}> {
  const { rows } = await query(
    `SELECT COUNT(1) AS c, AVG(ea.total_score) AS avg_score,
            SUM(CASE WHEN ea.is_pass = true THEN 1 ELSE 0 END) AS pass_c
     FROM exam_attempts ea
     JOIN users u ON u.id = ea.user_id
     ${orgUnitId ? 'WHERE u.org_unit_id = $1' : ''}`,
    orgUnitId ? [orgUnitId] : [],
  )
  const row = rows[0]

  const attemptCount = Number(row?.c ?? 0)
  return {
    attemptCount,
    avgExamScore: attemptCount > 0 ? Math.round(Number(row?.avg_score ?? 0)) : 0,
    passRate: attemptCount > 0 ? Math.round((Number(row?.pass_c ?? 0) / attemptCount) * 100) : 0,
  }
}
