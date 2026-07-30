import type { AuthContext } from './http.js'
import { query } from '../db.js'

type QueryRunner = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
}

const defaultRunner: QueryRunner = {
  query: (text, values) => query(text, values),
}

export async function getAccessibleContentIds(
  auth: Pick<AuthContext, 'userId' | 'role'>,
  runner: QueryRunner = defaultRunner,
): Promise<Set<string>> {
  if (auth.role === 'admin') {
    const { rows } = await runner.query('SELECT id FROM contents')
    return new Set(rows.map((row) => String(row.id)))
  }

  const { rows } = await runner.query(
    `SELECT DISTINCT c.id
     FROM contents c
     LEFT JOIN task_contents tc ON tc.content_id = c.id
     LEFT JOIN learning_tasks lt ON lt.id = tc.task_id
     LEFT JOIN users u ON u.org_unit_id = lt.org_unit_id AND u.id = $1
     WHERE c.is_public = true OR u.id IS NOT NULL`,
    [auth.userId],
  )
  return new Set(rows.map((row) => String(row.id)))
}

export async function canAccessContent(
  auth: Pick<AuthContext, 'userId' | 'role'>,
  contentId: string,
  runner: QueryRunner = defaultRunner,
): Promise<boolean> {
  if (auth.role === 'admin') {
    return Boolean((await runner.query('SELECT 1 FROM contents WHERE id = $1', [contentId])).rowCount)
  }
  const { rowCount } = await runner.query(
    `SELECT 1
     FROM contents c
     WHERE c.id = $2 AND (
       c.is_public = true OR EXISTS (
         SELECT 1
         FROM task_contents tc
         JOIN learning_tasks lt ON lt.id = tc.task_id
         JOIN users u ON u.org_unit_id = lt.org_unit_id
         WHERE tc.content_id = c.id AND u.id = $1
       )
     )`,
    [auth.userId, contentId],
  )
  return Boolean(rowCount)
}
