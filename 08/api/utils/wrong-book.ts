import { query } from '../db.js'
import { parseJson, toIso } from './json.js'
import type { QuestionType } from '../../shared/types.js'

export type WrongBookReviewStatus = 'pending' | 'mastered'

type WrongRow = {
  question_id: string
  attempt_id: string
  created_at: unknown
  exam_title: string
  answer_json: unknown
  earned_score: number
  max_score: number
  wrong_count: number
  type: string
  category: string
  stem: string
  options_json: unknown
  answer_key_json: unknown
}

type ProgressRow = {
  question_id: string
  review_correct_count: number
}

export function formatAnswerLabel(
  type: QuestionType,
  value: unknown,
  options: Array<{ key: string; text: string }> | null,
): string {
  if (value === null || value === undefined || value === '') return '未作答'
  if (type === 'tf') {
    if (typeof value === 'boolean') return value ? '正确' : '错误'
    if (value === 'true' || value === '1') return '正确'
    if (value === 'false' || value === '0') return '错误'
    return String(value)
  }
  const optMap = new Map((options ?? []).map((o) => [String(o.key), o.text]))
  const keys = Array.isArray(value) ? value.map(String) : [String(value)]
  return keys
    .map((k) => {
      const text = optMap.get(k)
      return text ? `${k}. ${text}` : k
    })
    .join('；')
}

export function scoreAnswer(type: QuestionType, expected: unknown, answer: unknown, maxScore: number) {
  if (type === 'single') {
    return expected && answer && String(expected) === String(answer) ? maxScore : 0
  }
  if (type === 'tf') {
    return typeof expected === 'boolean' && typeof answer === 'boolean' && expected === answer ? maxScore : 0
  }
  if (type === 'multiple') {
    const exp = Array.isArray(expected) ? expected.map(String).sort().join('|') : ''
    const got = Array.isArray(answer) ? answer.map(String).sort().join('|') : ''
    return exp && got && exp === got ? maxScore : 0
  }
  return 0
}

/** 重练判分后的复习进度变更（纯逻辑，便于单测） */
export function nextReviewProgress(
  currentCount: number,
  isCorrect: boolean,
): { reviewCorrectCount: number; reviewStatus: WrongBookReviewStatus; removed: boolean } {
  const count = Math.max(0, Math.min(2, currentCount))
  if (count >= 2) {
    return { reviewCorrectCount: 2, reviewStatus: 'mastered', removed: true }
  }
  if (isCorrect) {
    if (count === 0) {
      return { reviewCorrectCount: 1, reviewStatus: 'mastered', removed: false }
    }
    return { reviewCorrectCount: 2, reviewStatus: 'mastered', removed: true }
  }
  if (count === 1) {
    return { reviewCorrectCount: 0, reviewStatus: 'pending', removed: false }
  }
  return { reviewCorrectCount: 0, reviewStatus: 'pending', removed: false }
}

async function fetchLatestWrongRows(userId: string, questionIds?: string[]) {
  const params: unknown[] = [userId]
  let idFilter = ''
  if (questionIds?.length) {
    params.push(questionIds)
    idFilter = `AND ea.question_id = ANY($${params.length}::text[])`
  }

  const { rows } = await query<WrongRow>(
    `WITH user_wrong AS (
       SELECT
         ea.question_id,
         att.id AS attempt_id,
         att.created_at,
         e.title AS exam_title,
         ea.answer_json,
         ea.score AS earned_score,
         COALESCE(pq.score, 0) AS max_score,
         q.type,
         q.category,
         q.stem,
         q.options_json,
         q.answer_key_json
       FROM exam_attempts att
       JOIN exam_answers ea ON ea.attempt_id = att.id
       JOIN exams e ON e.id = att.exam_id
       JOIN questions q ON q.id = ea.question_id
       LEFT JOIN paper_questions pq ON pq.paper_id = e.paper_id AND pq.question_id = ea.question_id
       WHERE att.user_id = $1
         ${idFilter}
         AND (
           COALESCE(pq.score, 0) = 0
           OR ea.score < COALESCE(pq.score, 0)
         )
     ),
     ranked AS (
       SELECT *,
         COUNT(*) OVER (PARTITION BY question_id) AS wrong_count,
         ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY created_at DESC) AS rn
       FROM user_wrong
     )
     SELECT
       question_id, attempt_id, created_at, exam_title, answer_json,
       earned_score, max_score, wrong_count, type, category, stem,
       options_json, answer_key_json
     FROM ranked
     WHERE rn = 1
     ORDER BY created_at DESC`,
    params,
  )
  return rows
}

async function loadProgressMap(userId: string, questionIds: string[]) {
  if (!questionIds.length) return new Map<string, number>()
  const { rows } = await query<ProgressRow>(
    `SELECT question_id, review_correct_count
     FROM wrong_book_progress
     WHERE user_id = $1 AND question_id = ANY($2::text[])`,
    [userId, questionIds],
  )
  return new Map(rows.map((r) => [String(r.question_id), Number(r.review_correct_count ?? 0)]))
}

function reviewStatusFromCount(count: number): WrongBookReviewStatus {
  return count >= 1 && count < 2 ? 'mastered' : 'pending'
}

function mapQuestionRow(
  row: WrongRow,
  includeAnswers: boolean,
  reviewCorrectCount: number,
) {
  const type = String(row.type) as QuestionType
  const options = parseJson<Array<{ key: string; text: string }>>(row.options_json)
  const expected = parseJson<unknown>(row.answer_key_json ?? null)
  const userAnswer = parseJson<unknown>(row.answer_json ?? null)
  const base = {
    questionId: String(row.question_id),
    type,
    category: String(row.category ?? ''),
    stem: String(row.stem ?? ''),
    options,
    wrongCount: Number(row.wrong_count ?? 1),
    lastWrongAt: toIso(row.created_at),
    lastExamTitle: String(row.exam_title ?? '测验'),
    lastAttemptId: String(row.attempt_id),
    reviewCorrectCount,
    reviewStatus: reviewStatusFromCount(reviewCorrectCount),
  }
  if (!includeAnswers) return base
  return {
    ...base,
    lastUserAnswer: userAnswer,
    correctAnswer: expected,
    lastUserAnswerLabel: formatAnswerLabel(type, userAnswer, options),
    correctAnswerLabel: formatAnswerLabel(type, expected, options),
  }
}

function isStillInWrongBook(reviewCorrectCount: number) {
  return reviewCorrectCount < 2
}

/** 测验交卷后：错题重置为「待复习」 */
export async function syncWrongBookFromExam(userId: string, wrongQuestionIds: string[]) {
  const ids = [...new Set(wrongQuestionIds.map(String).filter(Boolean))]
  if (!ids.length) return
  const now = new Date().toISOString()
  for (const questionId of ids) {
    await query(
      `INSERT INTO wrong_book_progress (user_id, question_id, review_correct_count, updated_at)
       VALUES ($1, $2, 0, $3)
       ON CONFLICT (user_id, question_id) DO UPDATE
       SET review_correct_count = 0, updated_at = EXCLUDED.updated_at`,
      [userId, questionId, now],
    )
  }
}

export async function listWrongBookForUser(
  userId: string,
  status: 'all' | WrongBookReviewStatus = 'all',
) {
  const rows = await fetchLatestWrongRows(userId)
  const progressMap = await loadProgressMap(
    userId,
    rows.map((r) => String(r.question_id)),
  )

  const items = rows
    .map((row) => {
      const reviewCorrectCount = progressMap.get(String(row.question_id)) ?? 0
      return mapQuestionRow(row, true, reviewCorrectCount)
    })
    .filter((item) => isStillInWrongBook(item.reviewCorrectCount))

  const pendingCount = items.filter((it) => it.reviewStatus === 'pending').length
  const masteredCount = items.filter((it) => it.reviewStatus === 'mastered').length
  const filtered =
    status === 'all' ? items : items.filter((it) => it.reviewStatus === status)

  const categoryMap = new Map<string, number>()
  for (const item of filtered) {
    const key = item.category || '未分类'
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + 1)
  }
  const categories = [...categoryMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))

  return {
    totalCount: items.length,
    pendingCount,
    masteredCount,
    categories,
    items: filtered,
  }
}

export async function getPracticeQuestions(userId: string, questionIds?: string[]) {
  const rows = await fetchLatestWrongRows(userId, questionIds)
  const progressMap = await loadProgressMap(
    userId,
    rows.map((r) => String(r.question_id)),
  )
  return rows
    .filter((row) => {
      const count = progressMap.get(String(row.question_id)) ?? 0
      return isStillInWrongBook(count)
    })
    .map((row) => {
      const reviewCorrectCount = progressMap.get(String(row.question_id)) ?? 0
      return mapQuestionRow(row, false, reviewCorrectCount)
    })
}

async function persistReviewProgress(userId: string, questionId: string, nextCount: number) {
  const now = new Date().toISOString()
  const count = Math.max(0, Math.min(2, nextCount))
  await query(
    `INSERT INTO wrong_book_progress (user_id, question_id, review_correct_count, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, question_id) DO UPDATE
     SET review_correct_count = EXCLUDED.review_correct_count, updated_at = EXCLUDED.updated_at`,
    [userId, questionId, count, now],
  )
}

export async function checkPracticeAnswers(userId: string, answers: Record<string, unknown>) {
  const questionIds = Object.keys(answers)
  if (!questionIds.length) {
    return {
      totalCount: 0,
      correctCount: 0,
      wrongCount: 0,
      details: [] as Array<Record<string, unknown>>,
      progressUpdates: [] as Array<{
        questionId: string
        reviewStatus: WrongBookReviewStatus
        removed: boolean
        toMastered: boolean
        backToPending: boolean
      }>,
    }
  }

  const rows = await fetchLatestWrongRows(userId, questionIds)
  const progressMap = await loadProgressMap(
    userId,
    rows.map((r) => String(r.question_id)),
  )
  const allowed = new Set(rows.map((r) => String(r.question_id)))
  const progressUpdates: Array<{
    questionId: string
    reviewStatus: WrongBookReviewStatus
    removed: boolean
    toMastered: boolean
    backToPending: boolean
  }> = []

  const details = rows.map((row) => {
    const questionId = String(row.question_id)
    const type = String(row.type) as QuestionType
    const options = parseJson<Array<{ key: string; text: string }>>(row.options_json)
    const expected = parseJson<unknown>(row.answer_key_json ?? null)
    const userAnswer = allowed.has(questionId) ? answers[questionId] : undefined
    const maxScore = Number(row.max_score ?? 1) || 1
    const score = scoreAnswer(type, expected, userAnswer, maxScore)
    const isCorrect = score >= maxScore
    return {
      questionId,
      type,
      category: String(row.category ?? ''),
      stem: String(row.stem ?? ''),
      options,
      userAnswer: userAnswer ?? null,
      correctAnswer: expected,
      userAnswerLabel: formatAnswerLabel(type, userAnswer, options),
      correctAnswerLabel: formatAnswerLabel(type, expected, options),
      isCorrect,
    }
  })

  for (const detail of details) {
    const currentCount = progressMap.get(detail.questionId) ?? 0
    const next = nextReviewProgress(currentCount, detail.isCorrect)
    progressUpdates.push({
      questionId: detail.questionId,
      reviewStatus: next.removed ? 'mastered' : next.reviewStatus,
      removed: next.removed,
      toMastered: detail.isCorrect && currentCount === 0,
      backToPending: !detail.isCorrect && currentCount === 1,
    })
    await persistReviewProgress(userId, detail.questionId, next.reviewCorrectCount)
  }

  const correctCount = details.filter((d) => d.isCorrect).length
  return {
    totalCount: details.length,
    correctCount,
    wrongCount: details.length - correctCount,
    details,
    progressUpdates,
  }
}
