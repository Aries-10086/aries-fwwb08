import type Database from 'better-sqlite3'

export function enableForeignKeys(db: Database.Database) {
  db.pragma('foreign_keys = ON')
}

export function isFkViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false
  const code = String((err as { code: string }).code)
  return (
    code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
    code === 'SQLITE_CONSTRAINT_TRIGGER' ||
    (code === 'SQLITE_CONSTRAINT' &&
      'message' in err &&
      String((err as { message: string }).message).toLowerCase().includes('foreign key'))
  )
}

function tableHasForeignKeys(db: Database.Database, table: string): boolean {
  const rows = db.prepare(`PRAGMA foreign_key_list(${table})`).all() as unknown[]
  return rows.length > 0
}

/** 启动时清理历史孤儿记录，避免迁移或删除时残留脏数据 */
export function cleanupOrphanRecords(db: Database.Database) {
  const statements = [
    'DELETE FROM users WHERE org_unit_id NOT IN (SELECT id FROM org_units)',
    'DELETE FROM org_units WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM org_units)',
    'DELETE FROM learning_tasks WHERE org_unit_id NOT IN (SELECT id FROM org_units)',
    'DELETE FROM task_contents WHERE task_id NOT IN (SELECT id FROM learning_tasks)',
    'DELETE FROM task_contents WHERE content_id NOT IN (SELECT id FROM contents)',
    'DELETE FROM learning_records WHERE user_id NOT IN (SELECT id FROM users)',
    'DELETE FROM learning_records WHERE content_id NOT IN (SELECT id FROM contents)',
    'DELETE FROM paper_questions WHERE paper_id NOT IN (SELECT id FROM papers)',
    'DELETE FROM paper_questions WHERE question_id NOT IN (SELECT id FROM questions)',
    'DELETE FROM exams WHERE org_unit_id NOT IN (SELECT id FROM org_units)',
    'DELETE FROM exams WHERE paper_id NOT IN (SELECT id FROM papers)',
    'DELETE FROM exam_attempts WHERE exam_id NOT IN (SELECT id FROM exams)',
    'DELETE FROM exam_attempts WHERE user_id NOT IN (SELECT id FROM users)',
    'DELETE FROM exam_answers WHERE attempt_id NOT IN (SELECT id FROM exam_attempts)',
    'DELETE FROM exam_answers WHERE question_id NOT IN (SELECT id FROM questions)',
    'DELETE FROM exam_sessions WHERE exam_id NOT IN (SELECT id FROM exams)',
    'DELETE FROM exam_sessions WHERE user_id NOT IN (SELECT id FROM users)',
    'DELETE FROM ai_reports WHERE user_id NOT IN (SELECT id FROM users)',
    'DELETE FROM ai_logs WHERE user_id NOT IN (SELECT id FROM users)',
  ]

  const run = db.transaction(() => {
    for (const sql of statements) db.prepare(sql).run()
  })
  run()
}

function examsHasMaxAttempts(db: Database.Database): boolean {
  const cols = db.prepare('PRAGMA table_info(exams)').all() as Array<{ name: string }>
  return cols.some((c) => c.name === 'max_attempts')
}

/**
 * 将现有表重建为带外键约束的版本（幂等：已迁移则跳过）。
 */
export function ensureForeignKeySchema(db: Database.Database) {
  enableForeignKeys(db)
  if (tableHasForeignKeys(db, 'users')) return

  db.pragma('foreign_keys = OFF')
  cleanupOrphanRecords(db)

  const hasMaxAttempts = examsHasMaxAttempts(db)

  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE org_units_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES org_units_new(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL
      );
      INSERT INTO org_units_new SELECT id, name, parent_id, created_at FROM org_units;
      DROP TABLE org_units;
      ALTER TABLE org_units_new RENAME TO org_units;

      CREATE TABLE contents_new (
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
      INSERT INTO contents_new SELECT id, type, title, body, category, tags_json, attachments_json, is_public, created_at, updated_at FROM contents;
      DROP TABLE contents;
      ALTER TABLE contents_new RENAME TO contents;

      CREATE TABLE questions_new (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        stem TEXT NOT NULL,
        options_json TEXT,
        answer_key_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO questions_new SELECT id, type, category, stem, options_json, answer_key_json, created_at, updated_at FROM questions;
      DROP TABLE questions;
      ALTER TABLE questions_new RENAME TO questions;

      CREATE TABLE papers_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        duration_min INTEGER NOT NULL,
        pass_score INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO papers_new SELECT id, title, duration_min, pass_score, created_at FROM papers;
      DROP TABLE papers;
      ALTER TABLE papers_new RENAME TO papers;

      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT,
        password_hash TEXT,
        role TEXT NOT NULL,
        org_unit_id TEXT NOT NULL REFERENCES org_units(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL
      );
      INSERT INTO users_new SELECT id, name, username, password_hash, role, org_unit_id, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;

      CREATE TABLE learning_tasks_new (
        id TEXT PRIMARY KEY,
        org_unit_id TEXT NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        due_at TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO learning_tasks_new SELECT id, org_unit_id, title, due_at, created_at FROM learning_tasks;
      DROP TABLE learning_tasks;
      ALTER TABLE learning_tasks_new RENAME TO learning_tasks;

      CREATE TABLE task_contents_new (
        task_id TEXT NOT NULL REFERENCES learning_tasks(id) ON DELETE CASCADE,
        content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, content_id)
      );
      INSERT INTO task_contents_new SELECT task_id, content_id FROM task_contents;
      DROP TABLE task_contents;
      ALTER TABLE task_contents_new RENAME TO task_contents;

      CREATE TABLE learning_records_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
        duration_ms INTEGER NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      INSERT INTO learning_records_new SELECT id, user_id, content_id, duration_ms, is_completed, created_at FROM learning_records;
      DROP TABLE learning_records;
      ALTER TABLE learning_records_new RENAME TO learning_records;

      CREATE TABLE paper_questions_new (
        paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
        score INTEGER NOT NULL,
        order_no INTEGER NOT NULL,
        PRIMARY KEY (paper_id, question_id)
      );
      INSERT INTO paper_questions_new SELECT paper_id, question_id, score, order_no FROM paper_questions;
      DROP TABLE paper_questions;
      ALTER TABLE paper_questions_new RENAME TO paper_questions;
    `)

    if (hasMaxAttempts) {
      db.exec(`
        CREATE TABLE exams_new (
          id TEXT PRIMARY KEY,
          org_unit_id TEXT NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
          paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE RESTRICT,
          title TEXT NOT NULL,
          duration_min INTEGER NOT NULL,
          pass_score INTEGER NOT NULL,
          status TEXT NOT NULL,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          created_at TEXT NOT NULL
        );
        INSERT INTO exams_new
          SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, status, COALESCE(max_attempts, 3), created_at
          FROM exams;
      `)
    } else {
      db.exec(`
        CREATE TABLE exams_new (
          id TEXT PRIMARY KEY,
          org_unit_id TEXT NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
          paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE RESTRICT,
          title TEXT NOT NULL,
          duration_min INTEGER NOT NULL,
          pass_score INTEGER NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        INSERT INTO exams_new
          SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, status, created_at
          FROM exams;
      `)
    }

    db.exec(`
      DROP TABLE exams;
      ALTER TABLE exams_new RENAME TO exams;

      CREATE TABLE exam_attempts_new (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_score INTEGER NOT NULL,
        is_pass INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO exam_attempts_new SELECT id, exam_id, user_id, total_score, is_pass, created_at FROM exam_attempts;
      DROP TABLE exam_attempts;
      ALTER TABLE exam_attempts_new RENAME TO exam_attempts;

      CREATE TABLE exam_answers_new (
        id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
        answer_json TEXT NOT NULL,
        score INTEGER NOT NULL
      );
      INSERT INTO exam_answers_new SELECT id, attempt_id, question_id, answer_json, score FROM exam_answers;
      DROP TABLE exam_answers;
      ALTER TABLE exam_answers_new RENAME TO exam_answers;

      CREATE TABLE exam_sessions_new (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL,
        submitted INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO exam_sessions_new SELECT id, exam_id, user_id, started_at, submitted FROM exam_sessions;
      DROP TABLE exam_sessions;
      ALTER TABLE exam_sessions_new RENAME TO exam_sessions;

      CREATE TABLE ai_reports_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        report_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO ai_reports_new SELECT id, user_id, report_json, created_at FROM ai_reports;
      DROP TABLE ai_reports;
      ALTER TABLE ai_reports_new RENAME TO ai_reports;

      CREATE TABLE ai_logs_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        meta_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO ai_logs_new SELECT id, user_id, action, meta_json, created_at FROM ai_logs;
      DROP TABLE ai_logs;
      ALTER TABLE ai_logs_new RENAME TO ai_logs;
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_unit_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_tasks_org ON learning_tasks(org_unit_id);
      CREATE INDEX IF NOT EXISTS idx_records_user ON learning_records(user_id);
      CREATE INDEX IF NOT EXISTS idx_exams_org ON exams(org_unit_id);
      CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id);
      CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_exam_sessions_user ON exam_sessions(user_id, exam_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_user_content ON learning_records(user_id, content_id);
    `)
  })

  migrate()
  enableForeignKeys(db)
}
