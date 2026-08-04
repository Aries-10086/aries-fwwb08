import { View, Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import './index.scss'

type Content = {
  id: string
  type: string
  title: string
  body: string
  category: string
}

export default function ContentDetailPage() {
  const router = useRouter()
  const id = router.params.id || ''
  const [content, setContent] = useState<Content | null>(null)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const startAt = useRef(Date.now())

  useEffect(() => {
    if (!id) return
    startAt.current = Date.now()
    void (async () => {
      try {
        const [data, progress] = await Promise.all([
          apiFetch<Content>(`/api/contents/${id}`),
          apiFetch<{ isCompleted?: boolean }>(
            `/api/learning/progress?contentId=${encodeURIComponent(id)}`,
          ),
        ])
        setContent(data)
        setCompleted(!!progress?.isCompleted)
        Taro.setNavigationBarTitle({ title: data.title || '内容详情' })
      } catch (e: any) {
        setError(e?.message ?? '加载失败')
      }
    })()
  }, [id])

  async function markDone() {
    if (!id) return
    setSaving(true)
    try {
      const durationMs = Math.max(1000, Date.now() - startAt.current)
      await apiFetch('/api/learning/record', {
        method: 'POST',
        body: JSON.stringify({ contentId: id, durationMs, isCompleted: true }),
      })
      setCompleted(true)
    } catch (e: any) {
      setError(e?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell>
      <Text className="back" onClick={() => Taro.navigateBack()}>
        ← 返回
      </Text>
      {error && <View className="m-error">{error}</View>}
      {content && (
        <>
          <Text className="detail-title">{content.title}</Text>
          <Text className="home-card__meta">{content.category}</Text>
          <View className="m-card detail-body">
            <Text className="detail-body__text">{content.body || '暂无正文'}</Text>
          </View>
          <View className="detail-actions">
            {completed ? (
              <Text className="ok">已完成学习</Text>
            ) : (
              <Button loading={saving} onClick={() => void markDone()}>
                {saving ? '保存中…' : '标记完成'}
              </Button>
            )}
          </View>
          <Text
            className="detail-link seal"
            onClick={() => Taro.redirectTo({ url: '/pages/exams/index' })}
          >
            去测验 →
          </Text>
        </>
      )}
    </PageShell>
  )
}
