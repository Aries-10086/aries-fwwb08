import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { nanoid } from 'nanoid'
import type { ContentType, ExamStatus, QuestionType, UserRole } from '../shared/types.js'
import { hashPassword } from './utils/password.js'
import { randomPassword } from './utils/token.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.resolve(__dirname, '../data')
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(dataDir, 'app.sqlite')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

export const db = new Database(dbPath)

export function nowIso() {
  return new Date().toISOString()
}

function json(value: unknown) {
  return JSON.stringify(value ?? null)
}

export function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS org_units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT,
      password_hash TEXT,
      role TEXT NOT NULL,
      org_unit_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contents (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      attachments_json TEXT NOT NULL DEFAULT '[]',
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learning_tasks (
      id TEXT PRIMARY KEY,
      org_unit_id TEXT NOT NULL,
      title TEXT NOT NULL,
      due_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_contents (
      task_id TEXT NOT NULL,
      content_id TEXT NOT NULL,
      PRIMARY KEY (task_id, content_id)
    );

    CREATE TABLE IF NOT EXISTS learning_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content_id TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      stem TEXT NOT NULL,
      options_json TEXT,
      answer_key_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      duration_min INTEGER NOT NULL,
      pass_score INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paper_questions (
      paper_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      order_no INTEGER NOT NULL,
      PRIMARY KEY (paper_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      org_unit_id TEXT NOT NULL,
      paper_id TEXT NOT NULL,
      title TEXT NOT NULL,
      duration_min INTEGER NOT NULL,
      pass_score INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exam_attempts (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      total_score INTEGER NOT NULL,
      is_pass INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exam_answers (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      answer_json TEXT NOT NULL,
      score INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      report_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      meta_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_unit_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_org ON learning_tasks(org_unit_id);
    CREATE INDEX IF NOT EXISTS idx_records_user ON learning_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_exams_org ON exams(org_unit_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id);
    CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_logs(user_id);
  `)

  ensureAuthColumns()
  ensureContentAttachmentsColumn()
}

function tableColumns(table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return new Set(rows.map((r) => r.name))
}

function ensureContentAttachmentsColumn() {
  const cols = tableColumns('contents')
  if (!cols.has('attachments_json')) {
    db.exec(`ALTER TABLE contents ADD COLUMN attachments_json TEXT NOT NULL DEFAULT '[]'`)
  }
}

function ensureAuthColumns() {
  const cols = tableColumns('users')
  if (!cols.has('username')) {
    db.exec('ALTER TABLE users ADD COLUMN username TEXT')
  }
  if (!cols.has('password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT')
  }

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL')

  const defaults: Array<{ id: string; username: string; password: string }> = [
    { id: 'u_admin_demo', username: 'admin', password: 'admin123' },
    { id: 'u_secretary_demo', username: 'secretary', password: 'secretary123' },
    { id: 'u_member_demo', username: 'member', password: 'member123' },
    { id: 'u_member_2', username: 'member2', password: 'member123' },
    { id: 'u_member_3', username: 'member3', password: 'member123' },
  ]

  const updateCreds = db.prepare(
    'UPDATE users SET username = ?, password_hash = ? WHERE id = ? AND (username IS NULL OR username = \'\' OR password_hash IS NULL OR password_hash = \'\')',
  )
  for (const item of defaults) {
    updateCreds.run(item.username, hashPassword(item.password), item.id)
  }

  const orphans = db
    .prepare("SELECT id, name FROM users WHERE username IS NULL OR username = '' OR password_hash IS NULL OR password_hash = ''")
    .all() as Array<{ id: string; name: string }>

  const fill = db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?')
  for (const row of orphans) {
    const base = `user_${row.id.replace(/^u_/, '').slice(0, 8).toLowerCase()}`
    let username = base
    let n = 1
    while (db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, row.id)) {
      username = `${base}_${n++}`
    }
    fill.run(username, hashPassword(randomPassword(16)), row.id)
  }
}

export function audit(userId: string, action: string, meta: unknown) {
  db.prepare('INSERT INTO ai_logs (id, user_id, action, meta_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(`log_${nanoid(12)}`, userId, action, json(meta), nowIso())
}

function count(table: string) {
  const row = db.prepare(`SELECT COUNT(1) as c FROM ${table}`).get() as { c: number }
  return Number(row?.c ?? 0)
}

export function seedIfEmpty() {
  if (count('org_units') > 0) return

  const ts = nowIso()

  const orgInsert = db.prepare(
    'INSERT INTO org_units (id, name, parent_id, created_at) VALUES (@id, @name, @parent_id, @created_at)',
  )
  const orgs = [
    { id: 'org_committee', name: '党委', parent_id: null },
    { id: 'org_branch_1', name: '第一党支部', parent_id: 'org_committee' },
    { id: 'org_branch_2', name: '第二党支部', parent_id: 'org_committee' },
    { id: 'org_branch_3', name: '第三党支部', parent_id: 'org_committee' },
  ]
  for (const o of orgs) orgInsert.run({ ...o, created_at: ts })

  const userInsert = db.prepare(
    'INSERT INTO users (id, name, username, password_hash, role, org_unit_id, created_at) VALUES (@id, @name, @username, @password_hash, @role, @org_unit_id, @created_at)',
  )
  const users: {
    id: string
    name: string
    username: string
    password: string
    role: UserRole
    org_unit_id: string
  }[] = [
    { id: 'u_admin_demo', name: '系统管理员（演示）', username: 'admin', password: 'admin123', role: 'admin', org_unit_id: 'org_committee' },
    { id: 'u_secretary_demo', name: '支部书记（演示）', username: 'secretary', password: 'secretary123', role: 'secretary', org_unit_id: 'org_branch_3' },
    { id: 'u_member_demo', name: '党员（演示）', username: 'member', password: 'member123', role: 'member', org_unit_id: 'org_branch_3' },
    { id: 'u_member_2', name: '党员乙', username: 'member2', password: 'member123', role: 'member', org_unit_id: 'org_branch_3' },
    { id: 'u_member_3', name: '党员丙', username: 'member3', password: 'member123', role: 'member', org_unit_id: 'org_branch_1' },
  ]
  for (const u of users) {
    userInsert.run({
      id: u.id,
      name: u.name,
      username: u.username,
      password_hash: hashPassword(u.password),
      role: u.role,
      org_unit_id: u.org_unit_id,
      created_at: ts,
    })
  }

  const contentInsert = db.prepare(
    `INSERT INTO contents (
      id, type, title, body, category, tags_json, is_public, created_at, updated_at
    ) VALUES (
      @id, @type, @title, @body, @category, @tags_json, @is_public, @created_at, @updated_at
    )`,
  )

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

  for (const c of contents) {
    contentInsert.run({
      id: c.id,
      type: c.type,
      title: c.title,
      body: c.body,
      category: c.category,
      tags_json: json(c.tags),
      is_public: c.isPublic ? 1 : 0,
      created_at: ts,
      updated_at: ts,
    })
  }

  const taskInsert = db.prepare(
    'INSERT INTO learning_tasks (id, org_unit_id, title, due_at, created_at) VALUES (@id, @org_unit_id, @title, @due_at, @created_at)',
  )
  const taskContentInsert = db.prepare('INSERT INTO task_contents (task_id, content_id) VALUES (?, ?)')

  const taskId = 'task_demo_1'
  taskInsert.run({
    id: taskId,
    org_unit_id: 'org_branch_3',
    title: '本周学习任务：党史要点 + 纪律边界',
    due_at: null,
    created_at: ts,
  })
  taskContentInsert.run(taskId, 'c_article_1')
  taskContentInsert.run(taskId, 'c_article_2')
  taskContentInsert.run(taskId, 'c_article_3')

  const qInsert = db.prepare(
    `INSERT INTO questions (id, type, category, stem, options_json, answer_key_json, created_at, updated_at)
     VALUES (@id, @type, @category, @stem, @options_json, @answer_key_json, @created_at, @updated_at)`,
  )

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

  for (const q of questions) {
    qInsert.run({
      id: q.id,
      type: q.type,
      category: q.category,
      stem: q.stem,
      options_json: q.options ? json(q.options) : null,
      answer_key_json: json(q.answerKey),
      created_at: ts,
      updated_at: ts,
    })
  }

  db.prepare('INSERT INTO papers (id, title, duration_min, pass_score, created_at) VALUES (?, ?, ?, ?, ?)')
    .run('paper_1', '党校基础测验（演示卷）', 10, 60, ts)

  const pqInsert = db.prepare(
    'INSERT INTO paper_questions (paper_id, question_id, score, order_no) VALUES (?, ?, ?, ?)',
  )
  pqInsert.run('paper_1', 'q_1', 40, 1)
  pqInsert.run('paper_1', 'q_2', 30, 2)
  pqInsert.run('paper_1', 'q_3', 30, 3)

  const examInsert = db.prepare(
    'INSERT INTO exams (id, org_unit_id, paper_id, title, duration_min, pass_score, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
  examInsert.run(
    'exam_1',
    'org_branch_3',
    'paper_1',
    '第三党支部：党校基础测验（演示）',
    10,
    60,
    'published' as ExamStatus,
    ts,
  )
}

