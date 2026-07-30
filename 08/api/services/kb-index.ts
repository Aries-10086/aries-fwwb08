import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { nanoid } from 'nanoid'
import { nowIso, query, withTransaction } from '../db.js'
import { parseJson } from '../utils/json.js'
import { callAIService } from './ai-service.js'

type Attachment = { id: string; name: string; url: string; mime?: string }
const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.pdf', '.docx'])
type Runner = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
}
const defaultRunner: Runner = {
  query: (text, values) => query(text, values),
}
const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads')

export async function enqueueContentIndex(contentId: string, runner: Runner = defaultRunner): Promise<string> {
  const content = (
    await runner.query(
      `SELECT id, title, body, attachments_json, updated_at
       FROM contents WHERE id = $1`,
      [contentId],
    )
  ).rows[0]
  if (!content) throw new Error('内容不存在，无法创建索引任务')

  const version = new Date(content.updated_at as string | Date).toISOString()
  const bodyId = `kbd_${nanoid(12)}`
  await runner.query(
    `INSERT INTO kb_documents
      (id, content_id, source_type, attachment_id, filename, content_version, status)
     VALUES ($1, $2, 'body', NULL, $3, $4, 'pending')
     ON CONFLICT (content_id, source_type, (COALESCE(attachment_id, ''))) DO UPDATE SET
       filename = EXCLUDED.filename, content_version = EXCLUDED.content_version,
       status = 'pending', error_message = NULL, updated_at = NOW()`,
    [bodyId, contentId, `${String(content.title)}.txt`, version],
  )

  const attachments = (parseJson<Attachment[]>(content.attachments_json) ?? []).filter((item) =>
    SUPPORTED_ATTACHMENT_EXTENSIONS.has(path.extname(item.name).toLowerCase()),
  )
  const activeAttachmentIds = attachments.map((item) => item.id)
  for (const attachment of attachments) {
    await runner.query(
      `INSERT INTO kb_documents
        (id, content_id, source_type, attachment_id, filename, content_version, status)
       VALUES ($1, $2, 'attachment', $3, $4, $5, 'pending')
       ON CONFLICT (content_id, source_type, (COALESCE(attachment_id, ''))) DO UPDATE SET
         filename = EXCLUDED.filename, content_version = EXCLUDED.content_version,
         status = 'pending', error_message = NULL, updated_at = NOW()`,
      [`kbd_${nanoid(12)}`, contentId, attachment.id, attachment.name, version],
    )
  }
  if (activeAttachmentIds.length) {
    await runner.query(
      `DELETE FROM kb_documents
       WHERE content_id = $1 AND source_type = 'attachment'
         AND NOT (attachment_id = ANY($2::text[]))`,
      [contentId, activeAttachmentIds],
    )
  } else {
    await runner.query(
      `DELETE FROM kb_documents WHERE content_id = $1 AND source_type = 'attachment'`,
      [contentId],
    )
  }

  const jobId = `kbj_${nanoid(12)}`
  await runner.query(
    `INSERT INTO kb_index_jobs (id, content_id, operation, status, created_at)
     VALUES ($1, $2, 'upsert', 'pending', $3)`,
    [jobId, contentId, nowIso()],
  )
  return jobId
}

export async function enqueueContentDelete(contentId: string, runner: Runner = defaultRunner): Promise<string> {
  const jobId = `kbj_${nanoid(12)}`
  await runner.query(
    `INSERT INTO kb_index_jobs (id, content_id, operation, status, created_at)
     VALUES ($1, $2, 'delete', 'pending', $3)`,
    [jobId, contentId, nowIso()],
  )
  return jobId
}

async function sourceDocuments(contentId: string) {
  const content = (
    await query(
      `SELECT id, title, body, is_public, updated_at, attachments_json
       FROM contents WHERE id = $1`,
      [contentId],
    )
  ).rows[0]
  if (!content) throw new Error('待索引内容不存在')
  const orgRows = (
    await query(
      `SELECT DISTINCT lt.org_unit_id
       FROM task_contents tc JOIN learning_tasks lt ON lt.id = tc.task_id
       WHERE tc.content_id = $1`,
      [contentId],
    )
  ).rows
  const orgIds = orgRows.map((row) => String(row.org_unit_id))
  const docRows = (
    await query('SELECT * FROM kb_documents WHERE content_id = $1 ORDER BY source_type, id', [contentId])
  ).rows
  const attachments = parseJson<Attachment[]>(content.attachments_json) ?? []
  const attachmentMap = new Map(attachments.map((item) => [item.id, item]))
  const common = {
    content_id: contentId,
    is_public: Boolean(content.is_public),
    org_unit_ids: orgIds,
    content_version: new Date(content.updated_at as string | Date).toISOString(),
    title: String(content.title),
    heading: '',
  }
  return Promise.all(docRows.map(async (document) => {
    if (document.source_type === 'body') {
      return {
        ...common,
        document_id: String(document.id),
        source_type: 'body',
        attachment_id: '',
        filename: String(document.filename),
        text: String(content.body),
      }
    }
    const attachment = attachmentMap.get(String(document.attachment_id))
    if (!attachment) throw new Error(`附件元数据不存在：${String(document.attachment_id)}`)
    const filename = path.basename(attachment.url)
    const fullPath = path.join(uploadsDir, filename)
    if (!filename || !fullPath.startsWith(uploadsDir)) throw new Error('附件路径非法')
    const bytes = await fs.readFile(fullPath)
    return {
      ...common,
      document_id: String(document.id),
      source_type: 'attachment',
      attachment_id: attachment.id,
      filename: attachment.name,
      content_base64: bytes.toString('base64'),
    }
  }))
}

export async function processKBJob(jobId: string): Promise<void> {
  const claimed = await withTransaction(async (client) => {
    const job = (
      await client.query(
        `SELECT * FROM kb_index_jobs WHERE id = $1 FOR UPDATE`,
        [jobId],
      )
    ).rows[0]
    if (!job || !['pending', 'failed'].includes(String(job.status))) return null
    await client.query(
      `UPDATE kb_index_jobs SET status = 'processing', started_at = NOW(),
       finished_at = NULL, error_message = NULL WHERE id = $1`,
      [jobId],
    )
    await client.query(
      `UPDATE kb_documents SET status = 'indexing', updated_at = NOW()
       WHERE content_id = $1`,
      [String(job.content_id)],
    )
    return { contentId: String(job.content_id), operation: String(job.operation) }
  })
  if (!claimed) return

  try {
    if (claimed.operation === 'delete') {
      await callAIService('/internal/index', {
        operation: 'delete',
        content_ids: [claimed.contentId],
      })
    } else {
      await callAIService('/internal/index', {
        operation: 'upsert',
        documents: await sourceDocuments(claimed.contentId),
      })
    }
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE kb_index_jobs SET status = 'succeeded', finished_at = NOW()
         WHERE id = $1`,
        [jobId],
      )
      await client.query(
        `UPDATE kb_documents SET status = 'ready', error_message = NULL, updated_at = NOW()
         WHERE content_id = $1`,
        [claimed.contentId],
      )
    })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : '索引失败'
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE kb_index_jobs SET status = 'failed', retry_count = retry_count + 1,
         error_message = $2, finished_at = NOW() WHERE id = $1`,
        [jobId, message],
      )
      await client.query(
        `UPDATE kb_documents SET status = 'failed', error_message = $2, updated_at = NOW()
         WHERE content_id = $1`,
        [claimed.contentId, message],
      )
    })
    throw error
  }
}

export function processKBJobBestEffort(jobId: string): void {
  void processKBJob(jobId).catch((error) => {
    console.error(`KB job ${jobId} failed:`, error instanceof Error ? error.message : error)
  })
}
