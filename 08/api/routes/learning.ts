import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { db, nowIso, audit } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'

const router = Router()

function upsertRecord(userId: string, contentId: string, durationMs: number, isCompleted: boolean) {
  const existing = db
    .prepare('SELECT id, duration_ms, is_completed FROM learning_records WHERE user_id = ? AND content_id = ?')
    .get(userId, contentId) as any

  const addMs = Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs)) : 0
  const ts = nowIso()

  if (existing?.id) {
    const nextDuration = Number(existing.duration_ms ?? 0) + addMs
    const nextCompleted = Number(existing.is_completed ?? 0) === 1 || isCompleted ? 1 : 0
    db.prepare(
      'UPDATE learning_records SET duration_ms = ?, is_completed = ?, created_at = ? WHERE id = ?',
    ).run(nextDuration, nextCompleted, ts, String(existing.id))
    return { id: String(existing.id), durationMs: nextDuration, isCompleted: nextCompleted === 1 }
  }

  const id = `lr_${nanoid(12)}`
  db.prepare(
    'INSERT INTO learning_records (id, user_id, content_id, duration_ms, is_completed, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, userId, contentId, addMs, isCompleted ? 1 : 0, ts)
  return { id, durationMs: addMs, isCompleted }
}

/** 学习进度：单条或全部 */
router.get('/progress', (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId } = getUserContext(req)
  const contentId = req.query.contentId ? String(req.query.contentId) : null

  if (contentId) {
    const row = db
      .prepare(
        'SELECT id, content_id, duration_ms, is_completed, created_at FROM learning_records WHERE user_id = ? AND content_id = ?',
      )
      .get(userId, contentId) as any
    res.status(200).json({
      success: true,
      data: row
        ? {
            contentId: String(row.content_id),
            durationMs: Number(row.duration_ms ?? 0),
            isCompleted: Number(row.is_completed ?? 0) === 1,
            updatedAt: row.created_at,
          }
        : { contentId, durationMs: 0, isCompleted: false, updatedAt: null },
    })
    return
  }

  const rows = db
    .prepare(
      'SELECT content_id, duration_ms, is_completed, created_at FROM learning_records WHERE user_id = ? ORDER BY created_at DESC',
    )
    .all(userId) as any[]

  res.status(200).json({
    success: true,
    data: rows.map((r) => ({
      contentId: String(r.content_id),
      durationMs: Number(r.duration_ms ?? 0),
      isCompleted: Number(r.is_completed ?? 0) === 1,
      updatedAt: r.created_at,
    })),
  })
})

router.post('/record', (req: Request, res: Response) => {
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

  const data = upsertRecord(userId, contentId, durationMs, isCompleted)
  audit(userId, 'learning.record', { contentId, durationMs, isCompleted })
  res.status(200).json({ success: true, data })
})

export default router
