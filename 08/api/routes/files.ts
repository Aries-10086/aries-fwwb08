import { Router, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import { extractBearerToken, verifyAccessToken } from '../utils/token.js'
import { query } from '../db.js'
import { rejectUnauthorized, rejectForbidden } from '../utils/http.js'
import { parseJson } from '../utils/json.js'
import { uploadsDir, type ContentAttachment } from './contents.js'
import type { AuthContext } from '../utils/http.js'
import { wrapAsyncRouter } from '../utils/async-router.js'

const router = Router()

async function loadAuthFromRequest(req: Request): Promise<AuthContext | null> {
  if (req.auth?.userId) return req.auth
  const qToken = String(req.query.access_token ?? '')
  const token = extractBearerToken(req) || qToken
  if (!token) return null
  const payload = verifyAccessToken(token)
  if (!payload?.sub) return null
  const row = (
    await query('SELECT id, name, username, role, org_unit_id FROM users WHERE id = $1', [payload.sub])
  ).rows[0]
  if (!row?.id) return null
  return {
    userId: String(row.id),
    name: String(row.name ?? ''),
    username: String(row.username ?? ''),
    role: String(row.role) as AuthContext['role'],
    orgUnitId: String(row.org_unit_id ?? ''),
  }
}

async function accessibleContentIdsForUser(userId: string) {
  const { rows } = await query(
    `SELECT DISTINCT c.id
     FROM contents c
     LEFT JOIN task_contents tc ON tc.content_id = c.id
     LEFT JOIN learning_tasks lt ON lt.id = tc.task_id
     LEFT JOIN users u ON u.org_unit_id = lt.org_unit_id AND u.id = $1
     WHERE c.is_public = true OR u.id IS NOT NULL`,
    [userId],
  )
  return new Set(rows.map((row) => String(row.id)))
}

async function canAccessFile(auth: AuthContext, filename: string) {
  if (auth.role === 'admin') return true
  const userId = auth.userId
  if (!userId) return false

  const allow = await accessibleContentIdsForUser(userId)
  const { rows } = await query(
    `SELECT id, attachments_json FROM contents
     WHERE attachments_json::text ILIKE $1`,
    [`%${filename}%`],
  )

  for (const row of rows) {
    if (!allow.has(String(row.id))) continue
    const attachments = parseJson<ContentAttachment[]>(row.attachments_json) ?? []
    if (attachments.some((a) => path.basename(String(a.url || '')) === filename)) {
      return true
    }
  }
  return false
}

async function sendFile(req: Request, res: Response) {
  const auth = await loadAuthFromRequest(req)
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

  if (!(await canAccessFile(auth, filename))) {
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

export default wrapAsyncRouter(router)
