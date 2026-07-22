import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { db, nowIso, audit } from '../db.js'
import { getUserContext, requireAuth, requireRole, rejectUnauthorized } from '../utils/http.js'
import { json, parseJson } from '../utils/json.js'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const uploadsDir = path.resolve(__dirname, '../uploads')

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

export type ContentAttachment = {
  id: string
  name: string
  url: string
  size: number
  mime: string
}

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

function accessibleContentIdsForUser(userId: string) {
  const user = db.prepare('SELECT org_unit_id from users WHERE id = ?').get(userId) as any
  if (!user?.org_unit_id) return new Set<string>()

  const taskIds = db
    .prepare('SELECT id FROM learning_tasks WHERE org_unit_id = ?')
    .all(String(user.org_unit_id)) as any[]

  const ids = new Set<string>()
  const publicRows = db.prepare('SELECT id FROM contents WHERE is_public = 1').all() as any[]
  for (const r of publicRows) ids.add(String(r.id))

  for (const t of taskIds) {
    const rows = db.prepare('SELECT content_id FROM task_contents WHERE task_id = ?').all(String(t.id)) as any[]
    for (const r of rows) ids.add(String(r.content_id))
  }

  return ids
}

function mapContent(r: any) {
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
    .map((item) => ({
      id: String((item as any)?.id ?? ''),
      name: String((item as any)?.name ?? ''),
      url: String((item as any)?.url ?? ''),
      size: Number((item as any)?.size ?? 0),
      mime: String((item as any)?.mime ?? ''),
    }))
    .filter((item) => item.id && item.url && item.name)
}

/** 管理员上传学习内容附件 */
router.post('/upload', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  upload.single('file')(req, res, (err: any) => {
    if (err) {
      res.status(400).json({ success: false, error: err?.message ?? '上传失败' })
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

    audit(userId || 'u_admin_demo', 'contents.upload', {
      name: attachment.name,
      size: attachment.size,
      url: attachment.url,
    })

    res.status(200).json({ success: true, data: attachment })
  })
})

router.get('/', (req: Request, res: Response) => {
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
  const params: any[] = []

  if (q) {
    where.push('(title LIKE ? OR body LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  if (type) {
    where.push('type = ?')
    params.push(type)
  }
  if (category) {
    where.push('category = ?')
    params.push(category)
  }
  if (isPublic === 0 || isPublic === 1) {
    where.push('is_public = ?')
    params.push(isPublic)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const rows = db
    .prepare(
      `SELECT id, type, title, body, category, tags_json, attachments_json, is_public, created_at, updated_at
       FROM contents
       ${whereSql}
       ORDER BY updated_at DESC
       LIMIT 300`,
    )
    .all(...params) as any[]

  let data = rows.map(mapContent)

  if (role === 'member' || role === 'secretary') {
    const allow = accessibleContentIdsForUser(userId)
    data = data.filter((x) => allow.has(String(x.id)))
  }

  res.status(200).json({ success: true, data })
})

router.get('/:id', (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const { role, userId } = getUserContext(req)
  const id = String(req.params.id)

  const row = db
    .prepare(
      `SELECT id, type, title, body, category, tags_json, attachments_json, is_public, created_at, updated_at
       FROM contents
       WHERE id = ?`,
    )
    .get(id) as any

  if (!row) {
    res.status(404).json({ success: false, error: '内容不存在' })
    return
  }

  if (role === 'member' || role === 'secretary') {
    const allow = accessibleContentIdsForUser(userId)
    if (!allow.has(id)) {
      res.status(403).json({ success: false, error: '无权限访问该内容' })
      return
    }
  }

  res.status(200).json({
    success: true,
    data: mapContent(row),
  })
})

router.post('/', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = `c_${nanoid(10)}`
  const ts = nowIso()
  const attachments = normalizeAttachments(req.body?.attachments)

  db.prepare(
    `INSERT INTO contents (id, type, title, body, category, tags_json, attachments_json, is_public, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    String(req.body?.type ?? 'article'),
    String(req.body?.title ?? ''),
    String(req.body?.body ?? ''),
    String(req.body?.category ?? ''),
    json(req.body?.tags ?? []),
    json(attachments),
    req.body?.isPublic ? 1 : 0,
    ts,
    ts,
  )

  audit(userId || 'u_admin_demo', 'contents.create', { id })
  res.status(200).json({ success: true, data: { id } })
})

router.put('/:id', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)
  const ts = nowIso()
  const attachments = normalizeAttachments(req.body?.attachments)

  db.prepare(
    `UPDATE contents SET type = ?, title = ?, body = ?, category = ?, tags_json = ?, attachments_json = ?, is_public = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    String(req.body?.type ?? 'article'),
    String(req.body?.title ?? ''),
    String(req.body?.body ?? ''),
    String(req.body?.category ?? ''),
    json(req.body?.tags ?? []),
    json(attachments),
    req.body?.isPublic ? 1 : 0,
    ts,
    id,
  )

  audit(userId || 'u_admin_demo', 'contents.update', { id })
  res.status(200).json({ success: true })
})

router.delete('/:id', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)

  const row = db.prepare('SELECT attachments_json FROM contents WHERE id = ?').get(id) as any
  const attachments = parseJson<ContentAttachment[]>(row?.attachments_json) ?? []
  for (const att of attachments) {
    const filename = path.basename(String(att.url || ''))
    if (!filename) continue
    const full = path.join(uploadsDir, filename)
    if (full.startsWith(uploadsDir) && fs.existsSync(full)) {
      try {
        fs.unlinkSync(full)
      } catch {
        null
      }
    }
  }

  db.prepare('DELETE FROM task_contents WHERE content_id = ?').run(id)
  db.prepare('DELETE FROM learning_records WHERE content_id = ?').run(id)
  db.prepare('DELETE FROM contents WHERE id = ?').run(id)

  audit(userId || 'u_admin_demo', 'contents.delete', { id })
  res.status(200).json({ success: true })
})

export default router
