import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import './index.scss'

type Item = {
  questionId: string
  stem: string
  category: string
  wrongCount: number
  lastExamTitle: string
  lastUserAnswerLabel: string
  correctAnswerLabel: string
}

type Book = { totalCount: number; items: Item[] }

export default function WrongBookPage() {
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setBook(await apiFetch<Book>('/api/exams/wrong-book/mine'))
      } catch (e: any) {
        setError(e?.message ?? '加载失败')
      }
    })()
  }, [])

  return (
    <PageShell tabPath="/pages/wrong-book/index">
      <Text className="m-title">错题本</Text>
      <Text className="m-sub">共 {book?.totalCount ?? 0} 题</Text>
      {error && <View className="m-error">{error}</View>}
      <View className="wb-list">
        {(book?.items ?? []).map((it) => (
          <View key={it.questionId} className="m-card wb-card">
            <Text className="wb-card__stem">{it.stem}</Text>
            <Text className="wb-card__meta">
              {it.category || '未分类'} · 错 {it.wrongCount} 次
            </Text>
            <View className="wb-card__btn">
              <Button
                variant="secondary"
                onClick={() => setExpanded(expanded === it.questionId ? null : it.questionId)}
              >
                {expanded === it.questionId ? '收起' : '查看解析'}
              </Button>
            </View>
            {expanded === it.questionId && (
              <View className="wb-explain">
                <Text>
                  你的答案：
                  <Text className="seal">{it.lastUserAnswerLabel || '—'}</Text>
                </Text>
                <Text>
                  正确答案：
                  <Text style={{ fontWeight: 500 }}>{it.correctAnswerLabel || '—'}</Text>
                </Text>
                {it.lastExamTitle ? <Text className="wb-card__meta">来源：{it.lastExamTitle}</Text> : null}
              </View>
            )}
          </View>
        ))}
        {(book?.items?.length ?? 0) === 0 && (
          <View className="m-empty">暂无错题，先去做测验吧</View>
        )}
      </View>
    </PageShell>
  )
}
