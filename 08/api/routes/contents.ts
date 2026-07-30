import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { query, withTransaction, nowIso, audit } from '../db.js'
import { getUserContext, requireAuth, requireRole, rejectUnauthorized } from '../utils/http.js'
import { json, parseJson } from '../utils/json.js'
import type { ContentAttachment } from '../../shared/types.js'
import { wrapAsyncRouter } from '../utils/async-router.js'
import { canAccessContent, getAccessibleContentIds } from '../utils/content-access.js'
import {
  enqueueContentDelete,
  enqueueContentIndex,
  processKBJobBestEffort,
} from '../services/kb-index.js'

export type { ContentAttachment }

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const uploadsDir = path.resolve(__dirname, '../uploads')

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const ALLOWED_EXT = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.md',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.mp4',
  '.webm',
  '.mov',
])

const ALLOWED_MIME_PREFIX = ['image/', 'video/', 'audio/', 'text/']
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/octet-stream',
])

function isAllowedMime(mime: string, ext: string) {
  const m = String(mime || '').toLowerCase()
  if (!m) return true
  if (ALLOWED_MIME_EXACT.has(m)) return true
  if (ALLOWED_MIME_PREFIX.some((p) => m.startsWith(p))) return true
  // 部分浏览器对 office 文件给 octet-stream，已在白名单
  return ext === '.txt' || ext === '.md' || ext === '.csv'
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    cb(null, `${nanoid(16)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    if (!ALLOWED_EXT.has(ext)) {
      cb(new Error('不支持的文件类型'))
      return
    }
    if (!isAllowedMime(file.mimetype || '', ext)) {
      cb(new Error('文件 MIME 类型不被允许'))
      return
    }
    cb(null, true)
  },
})

function mapContent(r: Record<string, unknown>) {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    category: r.category,
    tags: parseJson<string[]>(r.tags_json) ?? [],
    attachments: parseJson<ContentAttachment[]>(r.attachments_json) ?? [],
    isPublic: !!r.is_public,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function normalizeAttachments(raw: unknown): ContentAttachment[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const value =
        typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}
      return {
        id: String(value.id ?? ''),
        name: String(value.name ?? ''),
        url: String(value.url ?? ''),
        size: Number(value.size ?? 0),
        mime: String(value.mime ?? ''),
      }
    })
    .filter((item) => item.id && item.url && item.name)
}

/** 管理员上传学习内容附件 */
router.post('/upload', (req: Request, res: Response, next) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  upload.single('file')(req, res, async (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : '上传失败'
      res.status(400).json({ success: false, error: message })
      return
    }

    const file = req.file
    if (!file) {
      res.status(400).json({ success: false, error: '请选择文件' })
      return
    }

    const { userId } = getUserContext(req)
    const attachment: ContentAttachment = {
      id: `att_${nanoid(10)}`,
      name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      url: `/api/files/${file.filename}`,
      size: file.size,
      mime: file.mimetype || 'application/octet-stream',
    }

    try {
      await audit(userId || 'u_admin_demo', 'contents.upload', {
        name: attachment.name,
        size: attachment.size,
        url: attachment.url,
      })
      res.status(200).json({ success: true, data: attachment })
    } catch (error) {
      next(error)
    }
  })
})

router.get('/', async (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const { role, userId } = getUserContext(req)
  const q = req.query.q ? String(req.query.q) : null
  const type = req.query.type ? String(req.query.type) : null
  const category = req.query.category ? String(req.query.category) : null
  const isPublic = req.query.isPublic ? Number(req.query.isPublic) : null

  const where: string[] = []
  const params: unknown[] = []

  if (q) {
    where.push(`(title ILIKE $${params.length + 1} OR body ILIKE $${params.length + 2})`)
    params.push(`%${q}%`, `%${q}%`)
  }
  if (type) {
    where.push(`type = $${params.length + 1}`)
    params.push(type)
  }
  if (category) {
    where.push(`category = $${params.length + 1}`)
    params.push(category)
  }
  if (isPublic === 0 || isPublic === 1) {
    where.push(`is_public = $${params.length + 1}`)
    params.push(isPublic === 1)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const { rows } = await query(
    `SELECT id, type, title, body, category, tags_json, attachments_json, is_public, created_at, updated_at
     FROM contents
     ${whereSql}
     ORDER BY updated_at DESC
     LIMIT 300`,
    params,
  )

  let data = rows.map(mapContent)

  // 非管理员始终按公共内容/本支部已派发内容过滤，避免列表与详情权限口径不一致。
  if (role !== 'admin') {
    const allow = await getAccessibleContentIds({ userId, role })
    data = data.filter((x) => allow.has(String(x.id)))
  }

  res.status(200).json({ success: true, data })
})

router.get('/:id', async (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const { role, userId } = getUserContext(req)
  const id = String(req.params.id)

  const row = (
    await query(
      `SELECT id, type, title, body, category, tags_json, attachments_json, is_public, created_at, updated_at
       FROM contents
       WHERE id = $1`,
      [id],
    )
  ).rows[0]

  if (!row) {
    res.status(404).json({ success: false, error: '内容不存在' })
    return
  }

  if (role !== 'admin') {
    if (!(await canAccessContent({ userId, role }, id))) {
      res.status(403).json({ success: false, error: '无权限访问该内容' })
      return
    }
  }

  res.status(200).json({
    success: true,
    data: mapContent(row),
  })
})

router.post('/', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = `c_${nanoid(10)}`
  const ts = nowIso()
  const attachments = normalizeAttachments(req.body?.attachments)

  const jobId = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO contents (id, type, title, body, category, tags_json, attachments_json, is_public, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)`,
      [
        id,
        String(req.body?.type ?? 'article'),
        String(req.body?.title ?? ''),
        String(req.body?.body ?? ''),
        String(req.body?.category ?? ''),
        json(req.body?.tags ?? []),
        json(attachments),
        Boolean(req.body?.isPublic),
        ts,
        ts,
      ],
    )
    return enqueueContentIndex(id, client)
  })

  await audit(userId || 'u_admin_demo', 'contents.create', { id })
  processKBJobBestEffort(jobId)
  res.status(200).json({ success: true, data: { id } })
})

router.put('/:id', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)
  const ts = nowIso()
  const attachments = normalizeAttachments(req.body?.attachments)

  const jobId = await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE contents SET type = $1, title = $2, body = $3, category = $4,
         tags_json = $5::jsonb, attachments_json = $6::jsonb, is_public = $7, updated_at = $8
       WHERE id = $9`,
      [
        String(req.body?.type ?? 'article'),
        String(req.body?.title ?? ''),
        String(req.body?.body ?? ''),
        String(req.body?.category ?? ''),
        json(req.body?.tags ?? []),
        json(attachments),
        Boolean(req.body?.isPublic),
        ts,
        id,
      ],
    )
    if (!result.rowCount) return null
    return enqueueContentIndex(id, client)
  })
  if (!jobId) {
    res.status(404).json({ success: false, error: '内容不存在' })
    return
  }

  await audit(userId || 'u_admin_demo', 'contents.update', { id })
  processKBJobBestEffort(jobId)
  res.status(200).json({ success: true })
})

router.delete('/:id', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)

  const row = (await query('SELECT attachments_json FROM contents WHERE id = $1', [id])).rows[0]
  if (!row) {
    res.status(404).json({ success: false, error: '内容不存在' })
    return
  }
  const attachments = parseJson<ContentAttachment[]>(row?.attachments_json) ?? []
  for (const att of attachments) {
    const filename = path.basename(String(att.url || ''))
    if (!filename) continue
    const full = path.join(uploadsDir, filename)
    if (full.startsWith(uploadsDir) && fs.existsSync(full)) {
      try {
        fs.unlinkSync(full)
      } catch {
        // 数据已删除，不因附件清理失败中断业务删除。
      }
    }
  }

  const jobId = await withTransaction(async (client) => {
    const deleteJobId = await enqueueContentDelete(id, client)
    await client.query('DELETE FROM task_contents WHERE content_id = $1', [id])
    await client.query('DELETE FROM learning_records WHERE content_id = $1', [id])
    await client.query('DELETE FROM contents WHERE id = $1', [id])
    return deleteJobId
  })

  await audit(userId || 'u_admin_demo', 'contents.delete', { id })
  processKBJobBestEffort(jobId)
  res.status(200).json({ success: true })
})

export default wrapAsyncRouter(router)
