import { Router, type Request, type Response } from 'express'
import { query, audit } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'
import { wrapAsyncRouter } from '../utils/async-router.js'
import { toIso } from '../utils/json.js'
import { upsertLearningRecord } from '../utils/learning-records.js'

const router = Router()

/** 学习进度：单条或全部（一行一内容，时长为累计值） */
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
        `SELECT content_id, duration_ms, is_completed, updated_at
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
            updatedAt: toIso(row.updated_at),
          }
        : { contentId, durationMs: 0, isCompleted: false, updatedAt: null },
    })
    return
  }

  const { rows } = await query(
    `SELECT content_id, duration_ms, is_completed, updated_at
     FROM learning_records WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId],
  )

  res.status(200).json({
    success: true,
    data: rows.map((r) => ({
      contentId: String(r.content_id),
      durationMs: Number(r.duration_ms ?? 0),
      isCompleted: Boolean(r.is_completed),
      updatedAt: toIso(r.updated_at),
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

  const content = (await query('SELECT id FROM contents WHERE id = $1', [contentId])).rows[0]
  if (!content) {
    res.status(404).json({ success: false, error: '学习内容不存在' })
    return
  }

  const data = await upsertLearningRecord(userId, contentId, durationMs, isCompleted)
  await audit(userId, 'learning.record', {
    contentId,
    durationMs,
    isCompleted,
    totalDurationMs: data.durationMs,
  })
  res.status(200).json({
    success: true,
    data: {
      id: data.id,
      durationMs: data.durationMs,
      isCompleted: data.isCompleted,
      updatedAt: data.updatedAt,
    },
  })
})

export default wrapAsyncRouter(router)
