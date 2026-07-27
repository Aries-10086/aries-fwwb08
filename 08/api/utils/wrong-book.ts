import { query } from '../db.js'
import { parseJson, toIso } from './json.js'
import type { QuestionType } from '../../shared/types.js'

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

function mapQuestionRow(row: WrongRow, includeAnswers: boolean) {
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

export async function listWrongBookForUser(userId: string) {
  const rows = await fetchLatestWrongRows(userId)
  const items = rows.map((row) => mapQuestionRow(row, true))
  const categoryMap = new Map<string, number>()
  for (const item of items) {
    const key = item.category || '未分类'
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + 1)
  }
  const categories = [...categoryMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))

  return {
    totalCount: items.length,
    categories,
    items,
  }
}

export async function getPracticeQuestions(userId: string, questionIds?: string[]) {
  const rows = await fetchLatestWrongRows(userId, questionIds)
  return rows.map((row) => mapQuestionRow(row, false))
}

export async function checkPracticeAnswers(userId: string, answers: Record<string, unknown>) {
  const questionIds = Object.keys(answers)
  if (!questionIds.length) {
    return { totalCount: 0, correctCount: 0, wrongCount: 0, details: [] as Array<Record<string, unknown>> }
  }

  const rows = await fetchLatestWrongRows(userId, questionIds)
  const allowed = new Set(rows.map((r) => String(r.question_id)))
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

  const correctCount = details.filter((d) => d.isCorrect).length
  return {
    totalCount: details.length,
    correctCount,
    wrongCount: details.length - correctCount,
    details,
  }
}
