import 'dotenv/config'
import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg'
import { nanoid } from 'nanoid'
import type { ContentType, ExamStatus, QuestionType, UserRole } from '../shared/types.js'
import { hashPassword } from './utils/password.js'
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://party_school:party_school@localhost:5432/party_school'

const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5_000),
  ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : undefined,
})

// 数据库重启或网络瞬断时，空闲连接会发出 error 事件；监听后连接池可自行补建连接。
pool.on('error', (error) => {
  console.error('PostgreSQL idle connection error:', error.message)
})

export type TransactionClient = Pick<PoolClient, 'query'>
export type TransactionCallback<T> = (client: TransactionClient) => Promise<T>

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, [...values])
}

export async function withTransaction<T>(
  callback: TransactionCallback<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export function nowIso(): string {
  return new Date().toISOString()
}

export async function audit(
  userId: string,
  action: string,
  meta: unknown,
): Promise<void> {
  await query(
    `INSERT INTO ai_logs (id, user_id, action, meta_json, created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [`log_${nanoid(12)}`, userId, action, JSON.stringify(meta ?? null), nowIso()],
  )
}

type Migration = {
  version: number
  name: string
  sql: string
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_initial_postgresql_schema',
    sql: `
      CREATE TABLE org_units (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES org_units(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT,
        password_hash TEXT,
        role TEXT NOT NULL CHECK (role IN ('admin', 'secretary', 'member')),
        org_unit_id TEXT NOT NULL REFERENCES org_units(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE contents (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('article', 'video')),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        category TEXT NOT NULL,
        tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        attachments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_public BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE learning_tasks (
        id TEXT PRIMARY KEY,
        org_unit_id TEXT NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        due_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE task_contents (
        task_id TEXT NOT NULL REFERENCES learning_tasks(id) ON DELETE CASCADE,
        content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, content_id)
      );

      CREATE TABLE learning_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
        duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL,
        UNIQUE (user_id, content_id)
      );

      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('single', 'multiple', 'tf')),
        category TEXT NOT NULL,
        stem TEXT NOT NULL,
        options_json JSONB,
        answer_key_json JSONB,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE papers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        duration_min INTEGER NOT NULL CHECK (duration_min > 0),
        pass_score INTEGER NOT NULL CHECK (pass_score >= 0),
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE paper_questions (
        paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
        score INTEGER NOT NULL CHECK (score >= 0),
        order_no INTEGER NOT NULL CHECK (order_no > 0),
        PRIMARY KEY (paper_id, question_id),
        UNIQUE (paper_id, order_no)
      );

      CREATE TABLE exams (
        id TEXT PRIMARY KEY,
        org_unit_id TEXT NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
        paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE RESTRICT,
        title TEXT NOT NULL,
        duration_min INTEGER NOT NULL CHECK (duration_min > 0),
        pass_score INTEGER NOT NULL CHECK (pass_score >= 0),
        status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'closed')),
        max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE exam_attempts (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_score INTEGER NOT NULL CHECK (total_score >= 0),
        is_pass BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE exam_answers (
        id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
        answer_json JSONB NOT NULL,
        score INTEGER NOT NULL CHECK (score >= 0),
        UNIQUE (attempt_id, question_id)
      );

      CREATE TABLE exam_sessions (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        started_at TIMESTAMPTZ NOT NULL,
        submitted BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE TABLE ai_reports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        report_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE ai_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        meta_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE UNIQUE INDEX idx_users_username
        ON users (LOWER(username)) WHERE username IS NOT NULL;
      CREATE INDEX idx_users_org ON users(org_unit_id);
      CREATE INDEX idx_tasks_org ON learning_tasks(org_unit_id);
      CREATE INDEX idx_task_contents_content ON task_contents(content_id);
      CREATE INDEX idx_records_user ON learning_records(user_id);
      CREATE INDEX idx_records_content ON learning_records(content_id);
      CREATE INDEX idx_paper_questions_question ON paper_questions(question_id);
      CREATE INDEX idx_exams_org ON exams(org_unit_id);
      CREATE INDEX idx_exams_paper ON exams(paper_id);
      CREATE INDEX idx_attempts_exam ON exam_attempts(exam_id);
      CREATE INDEX idx_attempts_user ON exam_attempts(user_id);
      CREATE INDEX idx_exam_answers_question ON exam_answers(question_id);
      CREATE INDEX idx_exam_sessions_user ON exam_sessions(user_id, exam_id);
      CREATE INDEX idx_ai_reports_user ON ai_reports(user_id);
      CREATE INDEX idx_ai_logs_user ON ai_logs(user_id);
    `,
  },
  {
    version: 2,
    name: 'learning_records_upsert_updated_at',
    sql: `
      -- 统一口径：一行一用户一内容；duration_ms 为累计时长；updated_at 为最近写入时间
      ALTER TABLE learning_records
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

      UPDATE learning_records
      SET updated_at = created_at
      WHERE updated_at IS NULL;

      ALTER TABLE learning_records
        ALTER COLUMN updated_at SET DEFAULT NOW();

      ALTER TABLE learning_records
        ALTER COLUMN updated_at SET NOT NULL;
    `,
  },
  {
    version: 3,
    name: 'ai_knowledge_and_chat_schema',
    sql: `
      CREATE TABLE llm_calls (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        purpose TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT,
        status TEXT NOT NULL CHECK (status IN ('success', 'error', 'aborted')),
        prompt_hash TEXT NOT NULL,
        usage_json JSONB,
        latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
        error_code TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE ai_cache (
        cache_key TEXT NOT NULL,
        version TEXT NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        result_json JSONB NOT NULL,
        model TEXT,
        source_updated_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (cache_key, version)
      );

      CREATE TABLE kb_documents (
        id TEXT PRIMARY KEY,
        content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
        source_type TEXT NOT NULL CHECK (source_type IN ('body', 'attachment')),
        attachment_id TEXT,
        filename TEXT NOT NULL,
        content_version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'indexing', 'ready', 'failed', 'deleted')),
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX idx_kb_documents_source
        ON kb_documents(content_id, source_type, COALESCE(attachment_id, ''));

      CREATE TABLE kb_index_jobs (
        id TEXT PRIMARY KEY,
        content_id TEXT NOT NULL,
        document_id TEXT REFERENCES kb_documents(id) ON DELETE SET NULL,
        operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ
      );

      CREATE TABLE chat_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content_id TEXT REFERENCES contents(id) ON DELETE SET NULL,
        title TEXT NOT NULL DEFAULT '新会话',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        tools_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_llm_calls_user_created ON llm_calls(user_id, created_at DESC);
      CREATE INDEX idx_llm_calls_purpose_created ON llm_calls(purpose, created_at DESC);
      CREATE INDEX idx_ai_cache_expires ON ai_cache(expires_at);
      CREATE INDEX idx_kb_documents_content ON kb_documents(content_id, status);
      CREATE INDEX idx_kb_jobs_status_created ON kb_index_jobs(status, created_at);
      CREATE INDEX idx_kb_jobs_content ON kb_index_jobs(content_id, created_at DESC);
      CREATE INDEX idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);
      CREATE INDEX idx_chat_messages_session_created ON chat_messages(session_id, created_at);
    `,
  },
  {
    version: 4,
    name: 'ai_provider_settings',
    sql: `
      CREATE TABLE ai_provider_settings (
        id TEXT PRIMARY KEY CHECK (id = 'default'),
        chat_base_url TEXT NOT NULL DEFAULT '',
        chat_model TEXT NOT NULL DEFAULT '',
        chat_api_key_enc TEXT,
        embedding_base_url TEXT NOT NULL DEFAULT '',
        embedding_model TEXT NOT NULL DEFAULT '',
        embedding_api_key_enc TEXT,
        embedding_dimension INTEGER CHECK (
          embedding_dimension IS NULL
          OR (embedding_dimension >= 64 AND embedding_dimension <= 65536)
        ),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
      );
    `,
  },
]

async function runMigrations(): Promise<void> {
  const client = await pool.connect()
  let lockAcquired = false
  try {
    await client.query('SELECT pg_advisory_lock($1)', [80_202_601])
    lockAcquired = true
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    for (const migration of migrations) {
      const applied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [migration.version],
      )
      if (applied.rowCount) continue

      await client.query('BEGIN')
      try {
        await client.query(migration.sql)
        await client.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name],
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    try {
      if (lockAcquired) {
        await client.query('SELECT pg_advisory_unlock($1)', [80_202_601])
      }
    } finally {
      client.release()
    }
  }
}

async function seedIfEmpty(): Promise<void> {
  await withTransaction(async (client) => {
    // 锁住根表，确保多个冷启动不会同时写入演示数据。
    await client.query('LOCK TABLE org_units IN SHARE ROW EXCLUSIVE MODE')
    const existing = await client.query('SELECT 1 FROM org_units LIMIT 1')
    if (existing.rowCount) return

    const ts = nowIso()
    const orgs = [
      { id: 'org_committee', name: '党委', parentId: null },
      { id: 'org_branch_1', name: '第一党支部', parentId: 'org_committee' },
      { id: 'org_branch_2', name: '第二党支部', parentId: 'org_committee' },
      { id: 'org_branch_3', name: '第三党支部', parentId: 'org_committee' },
    ]
    for (const org of orgs) {
      await client.query(
        'INSERT INTO org_units (id, name, parent_id, created_at) VALUES ($1, $2, $3, $4)',
        [org.id, org.name, org.parentId, ts],
      )
    }

    const users: Array<{
      id: string
      name: string
      username: string
      password: string
      role: UserRole
      orgUnitId: string
    }> = [
      { id: 'u_admin_demo', name: '系统管理员（演示）', username: 'admin', password: 'admin123', role: 'admin', orgUnitId: 'org_committee' },
      { id: 'u_secretary_demo', name: '支部书记（演示）', username: 'secretary', password: 'secretary123', role: 'secretary', orgUnitId: 'org_branch_3' },
      { id: 'u_member_demo', name: '党员（演示）', username: 'member', password: 'member123', role: 'member', orgUnitId: 'org_branch_3' },
      { id: 'u_member_2', name: '党员乙', username: 'member2', password: 'member123', role: 'member', orgUnitId: 'org_branch_3' },
      { id: 'u_member_3', name: '党员丙', username: 'member3', password: 'member123', role: 'member', orgUnitId: 'org_branch_1' },
    ]
    for (const user of users) {
      await client.query(
        `INSERT INTO users
          (id, name, username, password_hash, role, org_unit_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          user.id,
          user.name,
          user.username,
          hashPassword(user.password),
          user.role,
          user.orgUnitId,
          ts,
        ],
      )
    }

    const contents: Array<{
      id: string
      type: ContentType
      title: string
      body: string
      category: string
      tags: string[]
      isPublic: boolean
    }> = [
      {
        id: 'c_article_1',
        type: 'article',
        title: '党史学习要点：从关键事件看精神谱系',
        body: '学习建议：先梳理时间线，再用“事件—人物—意义—启示”结构复盘。',
        category: '党史',
        tags: ['党史', '时间线', '要点'],
        isPublic: true,
      },
      {
        id: 'c_article_2',
        type: 'article',
        title: '纪律学习：常见边界与案例提示',
        body: '重点关注“边界条件”和“风险点”，并结合真实案例进行对照学习。',
        category: '纪律',
        tags: ['纪律', '案例', '边界'],
        isPublic: true,
      },
      {
        id: 'c_video_1',
        type: 'video',
        title: '微党课：基层党务工作常见流程（示例视频）',
        body: 'https://example.com/video\n\n说明：演示用视频链接占位，可替换为真实地址。',
        category: '党务',
        tags: ['党务', '流程', '微党课'],
        isPublic: true,
      },
      {
        id: 'c_article_3',
        type: 'article',
        title: '支部工作清单：学习任务组织与落实',
        body: '建议以支部为单位：任务发布→提醒→过程记录→复盘总结→统计归档。',
        category: '党务',
        tags: ['支部', '任务', '复盘'],
        isPublic: false,
      },
    ]
    for (const content of contents) {
      await client.query(
        `INSERT INTO contents
          (id, type, title, body, category, tags_json, is_public, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $8)`,
        [
          content.id,
          content.type,
          content.title,
          content.body,
          content.category,
          JSON.stringify(content.tags),
          content.isPublic,
          ts,
        ],
      )
    }

    await client.query(
      `INSERT INTO learning_tasks (id, org_unit_id, title, due_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'task_demo_1',
        'org_branch_3',
        '本周学习任务：党史要点 + 纪律边界',
        null,
        ts,
      ],
    )
    for (const contentId of ['c_article_1', 'c_article_2', 'c_article_3']) {
      await client.query(
        'INSERT INTO task_contents (task_id, content_id) VALUES ($1, $2)',
        ['task_demo_1', contentId],
      )
    }

    const questions: Array<{
      id: string
      type: QuestionType
      category: string
      stem: string
      options?: { key: string; text: string }[]
      answerKey: unknown
    }> = [
      {
        id: 'q_1',
        type: 'single',
        category: '党史',
        stem: '学习党史时，为提升学习效果，下列做法更优的是？',
        options: [
          { key: 'A', text: '只记结论，不关心过程与背景' },
          { key: 'B', text: '以时间线为主线，结合人物与意义进行复盘' },
          { key: 'C', text: '只看标题，不做笔记' },
          { key: 'D', text: '只刷题，不做归纳总结' },
        ],
        answerKey: 'B',
      },
      {
        id: 'q_2',
        type: 'tf',
        category: '纪律',
        stem: '纪律学习中，理解“边界条件”有助于减少风险。',
        answerKey: true,
      },
      {
        id: 'q_3',
        type: 'multiple',
        category: '党务',
        stem: '学习任务落实过程中，下列哪些环节有助于提升完成率？',
        options: [
          { key: 'A', text: '任务发布与明确截止' },
          { key: 'B', text: '过程提醒与记录' },
          { key: 'C', text: '复盘总结与归档' },
          { key: 'D', text: '不做统计，凭感觉判断' },
        ],
        answerKey: ['A', 'B', 'C'],
      },
    ]
    for (const question of questions) {
      await client.query(
        `INSERT INTO questions
          (id, type, category, stem, options_json, answer_key_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $7)`,
        [
          question.id,
          question.type,
          question.category,
          question.stem,
          question.options ? JSON.stringify(question.options) : null,
          JSON.stringify(question.answerKey),
          ts,
        ],
      )
    }

    await client.query(
      `INSERT INTO papers (id, title, duration_min, pass_score, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      ['paper_1', '党校基础测验（演示卷）', 10, 60, ts],
    )
    const paperQuestions = [
      ['q_1', 40, 1],
      ['q_2', 30, 2],
      ['q_3', 30, 3],
    ] as const
    for (const [questionId, score, orderNo] of paperQuestions) {
      await client.query(
        `INSERT INTO paper_questions (paper_id, question_id, score, order_no)
         VALUES ($1, $2, $3, $4)`,
        ['paper_1', questionId, score, orderNo],
      )
    }

    await client.query(
      `INSERT INTO exams
        (id, org_unit_id, paper_id, title, duration_min, pass_score, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'exam_1',
        'org_branch_3',
        'paper_1',
        '第三党支部：党校基础测验（演示）',
        10,
        60,
        'published' as ExamStatus,
        ts,
      ],
    )
  })
}

let initialization: Promise<void> | undefined

export function initializeDatabase(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      await runMigrations()
      await seedIfEmpty()
    })().catch((error) => {
      initialization = undefined
      throw error
    })
  }
  return initialization
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await query('SELECT 1')
    return true
  } catch {
    return false
  }
}
