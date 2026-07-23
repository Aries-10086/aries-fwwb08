import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ArrowLeft, CheckCircle2, CircleX, ListChecks } from 'lucide-react'

type ReviewDetail = {
  orderNo: number
  questionId: string
  type: string
  category: string
  stem: string
  userAnswerLabel: string
  correctAnswerLabel: string
  score: number
  maxScore: number
  isCorrect: boolean
}

type AttemptReview = {
  attemptId: string
  examId: string
  examTitle: string
  totalScore: number
  passScore: number
  isPass: boolean
  createdAt: string
  correctCount: number
  wrongCount: number
  details: ReviewDetail[]
  wrongDetails: ReviewDetail[]
}

export function ExamReviewPanel({
  review,
  defaultWrongOnly = false,
}: {
  review: AttemptReview
  defaultWrongOnly?: boolean
}) {
  const [wrongOnly, setWrongOnly] = useState(defaultWrongOnly)
  const list = wrongOnly ? review.wrongDetails : review.details

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ['总分', `${review.totalScore}`],
          ['及格线', `${review.passScore}`],
          ['正确', `${review.correctCount}`],
          ['错题', `${review.wrongCount}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(14,17,22,0.4)]">{k}</div>
            <div className="mt-1 text-xl font-bold text-[#0e1116]">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-[rgba(14,17,22,0.55)]">
          结果：
          <span className={review.isPass ? 'font-semibold text-[#1f6b4a]' : 'font-semibold text-[#a31828]'}>
            {review.isPass ? '通过' : '未通过'}
          </span>
          <span className="ml-2 text-xs">
            {new Date(review.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant={!wrongOnly ? 'primary' : 'secondary'}
            className="px-3 py-1.5 text-xs"
            onClick={() => setWrongOnly(false)}
          >
            全部题目
          </Button>
          <Button
            variant={wrongOnly ? 'primary' : 'secondary'}
            className="px-3 py-1.5 text-xs"
            onClick={() => setWrongOnly(true)}
          >
            仅看错题（{review.wrongCount}）
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {list.map((d, idx) => (
          <div
            key={d.questionId}
            className={[
              'rounded-xl p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
              d.isCorrect ? 'bg-[rgba(31,107,74,0.05)]' : 'bg-[rgba(163,24,40,0.05)]',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                {d.isCorrect ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6b4a]" />
                ) : (
                  <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-[#a31828]" />
                )}
                <div>
                  <div className="text-sm font-medium text-[#0e1116]">
                    {d.orderNo || idx + 1}. {d.stem}
                  </div>
                  <div className="mt-1 text-xs text-[rgba(14,17,22,0.45)]">
                    {d.category} · {d.type === 'tf' ? '判断' : d.type === 'multiple' ? '多选' : '单选'}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-sm font-semibold text-[#0e1116]">
                {d.score}/{d.maxScore}
              </div>
            </div>
            <div className="mt-3 grid gap-1.5 text-sm md:grid-cols-2">
              <div className="rounded-lg bg-white/80 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]">
                <div className="text-[11px] text-[rgba(14,17,22,0.4)]">你的答案</div>
                <div className={d.isCorrect ? 'mt-1 text-[#1f6b4a]' : 'mt-1 text-[#a31828]'}>
                  {d.userAnswerLabel}
                </div>
              </div>
              <div className="rounded-lg bg-white/80 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]">
                <div className="text-[11px] text-[rgba(14,17,22,0.4)]">正确答案</div>
                <div className="mt-1 text-[#0e1116]">{d.correctAnswerLabel}</div>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="py-8 text-center text-sm text-zinc-400">
            {wrongOnly ? '本次全部答对，没有错题' : '暂无题目明细'}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MobileExamResult() {
  const nav = useNavigate()
  const { attemptId } = useParams()
  const [search] = useSearchParams()
  const { user } = useAuthStore()
  const [review, setReview] = useState<AttemptReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wrongOnlyDefault = search.get('wrong') === '1'

  useEffect(() => {
    if (!user) nav('/login')
  }, [nav, user])

  useEffect(() => {
    if (!attemptId) return
    setError(null)
    apiFetch<AttemptReview>(`/api/exams/attempts/${attemptId}`)
      .then(setReview)
      .catch((e: any) => setError(e?.message ?? '加载失败'))
  }, [attemptId])

  const backTo = useMemo(() => (review?.examId ? `/m/exam/${review.examId}` : '/m/exams'), [review?.examId])

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">考试结果</div>
          <h1 className="page-title text-3xl md:text-4xl">{review?.examTitle ?? '成绩回顾'}</h1>
          <div className="page-subtitle mt-2 max-w-2xl">查看得分明细与错题回顾</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/m/exams">
            <Button variant="secondary">
              <ListChecks className="h-4 w-4" />
              测验列表
            </Button>
          </Link>
          <Link to={backTo}>
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020]">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>答题回顾</CardTitle>
        </CardHeader>
        <CardContent>
          {review ? (
            <ExamReviewPanel review={review} defaultWrongOnly={wrongOnlyDefault} />
          ) : (
            <div className="py-10 text-sm text-zinc-400">加载中…</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
