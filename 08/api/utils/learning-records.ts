import { nanoid } from 'nanoid'
import { query, nowIso } from '../db.js'
import { toIso } from './json.js'

/**
 * 学习记录口径（全站统一）：
 * - 唯一键：(user_id, content_id) —— 一行一用户一内容
 * - duration_ms：累计学习时长（毫秒）；写入接口入参 durationMs 为本次增量
 * - is_completed：一旦为 true 不可回退
 * - 完成率（支部/任务）：任务全部 content 均完成的人数 / 党员数
 * - 个人完成数：is_completed = true 的内容条数（= 完成内容数，非行数膨胀）
 */

/** 单次写入时长增量上限，避免长时间挂页导致虚高（2 小时） */
export const MAX_SESSION_DURATION_MS = 2 * 60 * 60 * 1000

export function normalizeDurationDelta(durationMs: number): number {
  if (!Number.isFinite(durationMs)) return 0
  return Math.min(MAX_SESSION_DURATION_MS, Math.max(0, Math.floor(durationMs)))
}

export type UpsertLearningResult = {
  id: string
  durationMs: number
  isCompleted: boolean
  updatedAt: string
}

export async function upsertLearningRecord(
  userId: string,
  contentId: string,
  durationMs: number,
  isCompleted: boolean,
): Promise<UpsertLearningResult> {
  const addMs = normalizeDurationDelta(durationMs)
  const ts = nowIso()
  const id = `lr_${nanoid(12)}`

  const row = (
    await query(
      `INSERT INTO learning_records
        (id, user_id, content_id, duration_ms, is_completed, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $6::timestamptz)
       ON CONFLICT (user_id, content_id) DO UPDATE SET
         duration_ms = learning_records.duration_ms + EXCLUDED.duration_ms,
         is_completed = learning_records.is_completed OR EXCLUDED.is_completed,
         updated_at = EXCLUDED.updated_at
       RETURNING id, duration_ms, is_completed, updated_at`,
      [id, userId, contentId, addMs, isCompleted, ts],
    )
  ).rows[0]

  return {
    id: String(row.id),
    durationMs: Number(row.duration_ms),
    isCompleted: Boolean(row.is_completed),
    updatedAt: toIso(row.updated_at) ?? String(row.updated_at),
  }
}

export type LearningAgg = {
  durationMs: number
  completedContentCount: number
  /** 有学习记录的内容数（含未完成） */
  recordCount: number
}

/** 按用户批量聚合学习时长与完成数（基于 upsert 后的一行一内容） */
export async function loadLearningAggByUserIds(
  userIds: string[],
  range?: { from: Date | null; to: Date | null },
): Promise<Map<string, LearningAgg>> {
  const map = new Map<string, LearningAgg>()
  for (const id of userIds) {
    map.set(id, { durationMs: 0, completedContentCount: 0, recordCount: 0 })
  }
  if (userIds.length === 0) return map

  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',')
  const params: unknown[] = [...userIds]
  let timeSql = ''
  if (range?.from && range?.to) {
    params.push(range.from.toISOString(), range.to.toISOString())
    const fromIdx = userIds.length + 1
    const toIdx = userIds.length + 2
    timeSql = ` AND updated_at >= $${fromIdx}::timestamptz AND updated_at < $${toIdx}::timestamptz`
  }

  const { rows } = await query(
    `SELECT user_id,
            COALESCE(SUM(duration_ms), 0) AS duration_ms,
            COALESCE(SUM(CASE WHEN is_completed THEN 1 ELSE 0 END), 0) AS completed_count,
            COUNT(1) AS record_count
     FROM learning_records
     WHERE user_id IN (${placeholders})${timeSql}
     GROUP BY user_id`,
    params,
  )

  for (const r of rows) {
    map.set(String(r.user_id), {
      durationMs: Number(r.duration_ms ?? 0),
      completedContentCount: Number(r.completed_count ?? 0),
      recordCount: Number(r.record_count ?? 0),
    })
  }
  return map
}
