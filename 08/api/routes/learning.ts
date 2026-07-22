import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { db, nowIso, audit } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'

const router = Router()

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

  const id = `lr_${nanoid(12)}`
  const ts = nowIso()

  db.prepare(
    'INSERT INTO learning_records (id, user_id, content_id, duration_ms, is_completed, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, userId, contentId, Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0, isCompleted ? 1 : 0, ts)

  audit(userId, 'learning.record', { contentId, durationMs, isCompleted })
  res.status(200).json({ success: true, data: { id } })
})

export default router

