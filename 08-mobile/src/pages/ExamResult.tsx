import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { ExplainButton } from '@/components/ExplainButton'

type WrongDetail = {
  questionId: string
  stem: string
  userAnswerLabel: string
  correctAnswerLabel: string
  score: number
  maxScore: number
}

type Review = {
  attemptId?: string
  examTitle: string
  totalScore: number
  passScore: number | null
  isPass: boolean
  createdAt: string
  wrongDetails?: WrongDetail[]
}

export default function ExamResult() {
  const { attemptId } = useParams()
  const [data, setData] = useState<Review | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!attemptId) return
    void (async () => {
      try {
        const res = await apiFetch<Review>(`/api/exams/attempts/${attemptId}`)
        setData(res)
      } catch (e: any) {
        setError(e?.message ?? '加载失败')
      }
    })()
  }, [attemptId])

  return (
    <div className="px-4 pb-8 pt-[max(1rem,var(--safe-top))]">
      <h1 className="pt-2 text-2xl font-bold">成绩结果</h1>
      {error && <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-sm text-seal-deep">{error}</div>}
      {data && (
        <>
          <div className="m-card mt-4 p-5 text-center">
            <div className="text-sm text-ink/50">{data.examTitle}</div>
            <div className={`mt-3 text-4xl font-black ${data.isPass ? 'text-[#1f6b4a]' : 'text-seal'}`}>
              {data.totalScore}
            </div>
            <div className="mt-1 text-sm text-ink/55">
              {data.isPass ? '通过' : '未通过'}
              {data.passScore != null ? ` · 及格线 ${data.passScore}` : ''}
            </div>
            <div className="mt-2 text-xs text-ink/40">{new Date(data.createdAt).toLocaleString()}</div>
          </div>

          {(data.wrongDetails?.length ?? 0) > 0 && (
            <div className="mt-4 grid gap-2">
              <div className="text-sm font-semibold">错题回顾</div>
              {data.wrongDetails!.map((d) => (
                <div key={d.questionId} className="m-card p-4">
                  <div className="text-sm font-medium leading-snug">{d.stem}</div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div>
                      <span className="text-ink/45">你的答案：</span>
                      <span className="text-seal">{d.userAnswerLabel}</span>
                    </div>
                    <div>
                      <span className="text-ink/45">正确答案（题库）：</span>
                      <span className="font-medium">{d.correctAnswerLabel}</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <ExplainButton
                      questionId={d.questionId}
                      attemptId={attemptId}
                      correctAnswerLabel={d.correctAnswerLabel}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div className="mt-4 grid gap-2">
        <Link to="/exams">
          <Button className="w-full">返回测验</Button>
        </Link>
        <Link to="/wrong-book">
          <Button variant="secondary" className="w-full">
            查看错题本
          </Button>
        </Link>
        <Link to="/chat">
          <Button variant="ghost" className="w-full">
            问 AI 助手
          </Button>
        </Link>
      </div>
    </div>
  )
}
