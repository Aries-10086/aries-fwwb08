import { Router, type Request, type Response } from 'express'
import { audit, query } from '../db.js'
import { enqueueContentIndex, processKBJob } from '../services/kb-index.js'
import { wrapAsyncRouter } from '../utils/async-router.js'
import { getUserContext, requireRole } from '../utils/http.js'

const router = Router()

router.get('/documents', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可查看知识库状态' })
    return
  }
  const contentId = req.query.contentId ? String(req.query.contentId) : ''
  const { rows } = await query(
    `SELECT d.id, d.content_id, d.source_type, d.attachment_id, d.filename,
            d.content_version, d.status, d.error_message, d.created_at, d.updated_at,
            c.title AS content_title
     FROM kb_documents d
     JOIN contents c ON c.id = d.content_id
     WHERE ($1 = '' OR d.content_id = $1)
     ORDER BY d.updated_at DESC LIMIT 500`,
    [contentId],
  )
  res.status(200).json({
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      contentId: row.content_id,
      contentTitle: row.content_title,
      sourceType: row.source_type,
      attachmentId: row.attachment_id,
      filename: row.filename,
      contentVersion: row.content_version,
      status: row.status,
      error: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  })
})

router.post('/reindex/:contentId', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可重建知识库索引' })
    return
  }
  const { userId } = getUserContext(req)
  const contentId = String(req.params.contentId)
  const exists = (await query('SELECT 1 FROM contents WHERE id = $1', [contentId])).rowCount
  if (!exists) {
    res.status(404).json({ success: false, error: '内容不存在' })
    return
  }
  const jobId = await enqueueContentIndex(contentId)
  try {
    await processKBJob(jobId)
  } catch {
    await audit(userId, 'kb.reindex', { contentId, jobId, status: 'failed' })
    res.status(503).json({
      success: false,
      error: '索引服务不可用，任务已保留，可再次提交重试',
      data: { jobId, status: 'failed' },
    })
    return
  }
  await audit(userId, 'kb.reindex', { contentId, jobId, status: 'succeeded' })
  res.status(200).json({ success: true, data: { jobId, status: 'succeeded' } })
})

/** 演示用：一键将全部学习内容写入/重建知识库索引 */
router.post('/reindex-all', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可重建知识库索引' })
    return
  }
  const { userId } = getUserContext(req)
  const { rows } = await query(
    `SELECT id, title FROM contents ORDER BY updated_at DESC LIMIT 100`,
  )
  const items: Array<{ contentId: string; title: string; jobId: string; status: string; error?: string }> = []
  for (const row of rows) {
    const contentId = String(row.id)
    const title = String(row.title ?? '')
    const jobId = await enqueueContentIndex(contentId)
    try {
      await processKBJob(jobId)
      items.push({ contentId, title, jobId, status: 'succeeded' })
    } catch (e) {
      items.push({
        contentId,
        title,
        jobId,
        status: 'failed',
        error: e instanceof Error ? e.message : '索引失败',
      })
    }
  }
  const succeeded = items.filter((x) => x.status === 'succeeded').length
  const failed = items.length - succeeded
  await audit(userId, 'kb.reindex_all', { total: items.length, succeeded, failed })
  res.status(failed > 0 && succeeded === 0 ? 503 : 200).json({
    success: succeeded > 0 || items.length === 0,
    error:
      failed > 0 && succeeded === 0
        ? '知识库索引全部失败：请确认已配置向量密钥，且 AI 服务可用（未安装 AI 时主流程仍可用）'
        : undefined,
    data: { total: items.length, succeeded, failed, items },
  })
})

router.get('/jobs/:id', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可查看索引任务' })
    return
  }
  const row = (
    await query(
      `SELECT id, content_id, document_id, operation, status, retry_count,
              error_message, created_at, started_at, finished_at
       FROM kb_index_jobs WHERE id = $1`,
      [String(req.params.id)],
    )
  ).rows[0]
  if (!row) {
    res.status(404).json({ success: false, error: '索引任务不存在' })
    return
  }
  res.status(200).json({
    success: true,
    data: {
      id: row.id,
      contentId: row.content_id,
      documentId: row.document_id,
      operation: row.operation,
      status: row.status,
      retryCount: Number(row.retry_count),
      error: row.error_message,
      createdAt: row.created_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    },
  })
})

export default wrapAsyncRouter(router)
