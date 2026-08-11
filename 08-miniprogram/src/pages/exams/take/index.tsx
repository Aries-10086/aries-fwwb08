import { View, Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import './index.scss'

type Question = {
  id: string
  type: 'single' | 'multiple' | 'tf'
  stem: string
  options?: { key: string; text: string }[] | null
  score: number
}

type ExamDetail = {
  id: string
  title: string
  durationMin: number
  passScore: number
  canAttempt: boolean
  paper: { questions: Question[] } | null
}

function formatRemain(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function ExamTakePage() {
  const router = useRouter()
  const examId = router.params.examId || ''
  const [exam, setExam] = useState<ExamDetail | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [remainMs, setRemainMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const autoSubmitted = useRef(false)
  const sessionIdRef = useRef<string | null>(null)
  const answersRef = useRef(answers)

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  async function submit(force = false) {
    const sid = sessionIdRef.current
    if (!examId || !sid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const data = await apiFetch<{ attemptId: string }>(`/api/exams/${examId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          sessionId: sid,
          answers: answersRef.current,
          forceTimeout: force,
        }),
      })
      Taro.redirectTo({ url: `/pages/exams/result/index?attemptId=${data.attemptId}` })
    } catch (e: any) {
      setError(e?.message ?? '交卷未成功，请您稍后重试')
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!examId) return
    void (async () => {
      try {
        const data = await apiFetch<ExamDetail>(`/api/exams/${examId}`)
        setExam(data)
        Taro.setNavigationBarTitle({ title: data.title || '测验' })
        if (!data.canAttempt) {
          setError('您已达最大作答次数')
          return
        }
        const session = await apiFetch<{ sessionId: string; expiresAt: string }>(
          `/api/exams/${examId}/start`,
          { method: 'POST', body: '{}' },
        )
        setSessionId(session.sessionId)
        setRemainMs(Math.max(0, new Date(session.expiresAt).getTime() - Date.now()))
      } catch (e: any) {
        setError(e?.message ?? '内容加载失败，请您稍后重试')
      }
    })()
  }, [examId])

  useEffect(() => {
    if (remainMs == null) return
    const t = setInterval(() => {
      setRemainMs((prev) => {
        if (prev == null) return prev
        const next = Math.max(0, prev - 1000)
        if (next <= 0 && !autoSubmitted.current) {
          autoSubmitted.current = true
          void submit(true)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(t)
  }, [remainMs == null, sessionId])

  const questions = exam?.paper?.questions ?? []

  return (
    <PageShell>
      <View className="take-top">
        <Text className="back" onClick={() => Taro.redirectTo({ url: '/pages/exams/index' })}>
          ← 请退出
        </Text>
        {remainMs != null && <Text className="take-timer">{formatRemain(remainMs)}</Text>}
      </View>
      <Text className="m-title" style={{ display: 'block', marginTop: '12px', fontSize: '20px' }}>
        {exam?.title ?? '测验'}
      </Text>
      {error && <View className="m-error">{error}</View>}

      <View className="take-list">
        {questions.map((q, idx) => (
          <View key={q.id} className="m-card take-q">
            <Text className="take-q__stem">
              {idx + 1}. {q.stem}
            </Text>
            {q.type === 'tf' && (
              <View className="take-tf">
                {[
                  { label: '正确', value: true },
                  { label: '错误', value: false },
                ].map((it) => (
                  <View
                    key={it.label}
                    className={`take-opt ${answers[q.id] === it.value ? 'is-on' : ''}`}
                    onClick={() => setAnswers((p) => ({ ...p, [q.id]: it.value }))}
                  >
                    <Text>{it.label}</Text>
                  </View>
                ))}
              </View>
            )}
            {(q.type === 'single' || q.type === 'multiple') && (
              <View className="take-opts">
                {(q.options ?? []).map((op) => {
                  const selected = answers[q.id]
                  const checked =
                    q.type === 'single'
                      ? selected === op.key
                      : Array.isArray(selected) && selected.includes(op.key)
                  return (
                    <View
                      key={op.key}
                      className={`take-opt take-opt--block ${checked ? 'is-soft' : ''}`}
                      onClick={() => {
                        if (q.type === 'single') {
                          setAnswers((p) => ({ ...p, [q.id]: op.key }))
                          return
                        }
                        const prev = Array.isArray(selected) ? (selected as string[]) : []
                        const next = prev.includes(op.key)
                          ? prev.filter((x) => x !== op.key)
                          : [...prev, op.key]
                        setAnswers((p) => ({ ...p, [q.id]: next }))
                      }}
                    >
                      <Text>
                        <Text className="take-opt__key">{op.key}. </Text>
                        {op.text}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        ))}
      </View>

      {sessionId && (
        <View className="take-submit">
          <Button loading={submitting} onClick={() => void submit(false)}>
            {submitting ? '正在交卷…' : '请提交答卷'}
          </Button>
        </View>
      )}
    </PageShell>
  )
}
