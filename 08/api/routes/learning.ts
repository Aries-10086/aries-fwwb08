import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { query, nowIso, audit } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'
import { wrapAsyncRouter } from '../utils/async-router.js'

const router = Router()

async function upsertRecord(userId: string, contentId: string, durationMs: number, isCompleted: boolean) {
  const addMs = Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs)) : 0
  const ts = nowIso()
  const id = `lr_${nanoid(12)}`
  const row = (
    await query(
      `INSERT INTO learning_records
        (id, user_id, content_id, duration_ms, is_completed, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, content_id) DO UPDATE SET
         duration_ms = learning_records.duration_ms + EXCLUDED.duration_ms,
         is_completed = learning_records.is_completed OR EXCLUDED.is_completed,
         created_at = EXCLUDED.created_at
       RETURNING id, duration_ms, is_completed`,
      [id, userId, contentId, addMs, isCompleted, ts],
    )
  ).rows[0]
  return {
    id: String(row.id),
    durationMs: Number(row.duration_ms),
    isCompleted: Boolean(row.is_completed),
  }
}

/** 学习进度：单条或全部 */
router.get('/progress', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId } = getUserContext(req)
  const contentId = req.query.contentId ? String(req.query.contentId) : null

  if (contentId) {
    const row = (
      await query(
        `SELECT id, content_id, duration_ms, is_completed, created_at
         FROM learning_records WHERE user_id = $1 AND content_id = $2`,
        [userId, contentId],
      )
    ).rows[0]
    res.status(200).json({
      success: true,
      data: row
        ? {
            contentId: String(row.content_id),
            durationMs: Number(row.duration_ms ?? 0),
            isCompleted: Boolean(row.is_completed),
            updatedAt: row.created_at,
          }
        : { contentId, durationMs: 0, isCompleted: false, updatedAt: null },
    })
    return
  }

  const { rows } = await query(
    `SELECT content_id, duration_ms, is_completed, created_at
     FROM learning_records WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  )

  res.status(200).json({
    success: true,
    data: rows.map((r) => ({
      contentId: String(r.content_id),
      durationMs: Number(r.duration_ms ?? 0),
      isCompleted: Boolean(r.is_completed),
      updatedAt: r.created_at,
    })),
  })
})

router.post('/record', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId } = getUserContext(req)
  const contentId = String(req.body?.contentId ?? '')
  const durationMs = Number(req.body?.durationMs ?? 0)
  const isCompleted = !!req.body?.isCompleted

  if (!userId || !contentId) {
    res.status(400).json({ success: false, error: '缺少参数' })
    return
  }

  const data = await upsertRecord(userId, contentId, durationMs, isCompleted)
  await audit(userId, 'learning.record', { contentId, durationMs, isCompleted })
  res.status(200).json({ success: true, data })
})

export default wrapAsyncRouter(router)
