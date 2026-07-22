import { Router, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import { extractBearerToken, verifyAccessToken } from '../utils/token.js'
import { db } from '../db.js'
import { rejectUnauthorized, rejectForbidden } from '../utils/http.js'
import { parseJson } from '../utils/json.js'
import { uploadsDir, type ContentAttachment } from './contents.js'
import type { AuthContext } from '../utils/http.js'

const router = Router()

function loadAuthFromRequest(req: Request): AuthContext | null {
  if (req.auth?.userId) return req.auth
  const qToken = String(req.query.access_token ?? '')
  const token = extractBearerToken(req) || qToken
  if (!token) return null
  const payload = verifyAccessToken(token)
  if (!payload?.sub) return null
  const row = db
    .prepare('SELECT id, name, username, role, org_unit_id FROM users WHERE id = ?')
    .get(payload.sub) as any
  if (!row?.id) return null
  return {
    userId: String(row.id),
    name: String(row.name ?? ''),
    username: String(row.username ?? ''),
    role: String(row.role) as AuthContext['role'],
    orgUnitId: String(row.org_unit_id ?? ''),
  }
}

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

function canAccessFile(auth: AuthContext, filename: string) {
  if (auth.role === 'admin') return true
  const userId = auth.userId
  if (!userId) return false

  const allow = accessibleContentIdsForUser(userId)
  const rows = db
    .prepare(
      `SELECT id, attachments_json FROM contents
       WHERE attachments_json LIKE ?`,
    )
    .all(`%${filename}%`) as any[]

  for (const row of rows) {
    if (!allow.has(String(row.id))) continue
    const attachments = parseJson<ContentAttachment[]>(row.attachments_json) ?? []
    if (attachments.some((a) => path.basename(String(a.url || '')) === filename)) {
      return true
    }
  }
  return false
}

function sendFile(req: Request, res: Response) {
  const auth = loadAuthFromRequest(req)
  if (!auth?.userId) {
    rejectUnauthorized(res)
    return
  }
  // 临时挂到 req，便于复用
  req.auth = auth

  const filename = path.basename(String(req.params.filename || ''))
  if (!filename || filename.includes('..')) {
    res.status(400).json({ success: false, error: '非法文件名' })
    return
  }

  if (!canAccessFile(auth, filename)) {
    rejectForbidden(res, '无权下载该文件')
    return
  }

  const full = path.join(uploadsDir, filename)
  if (!full.startsWith(uploadsDir) || !fs.existsSync(full)) {
    res.status(404).json({ success: false, error: '文件不存在' })
    return
  }

  res.sendFile(full)
}

/** 需登录且有内容访问权才可下载 */
router.get('/:filename', sendFile)

export default router
