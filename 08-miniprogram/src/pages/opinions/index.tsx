import { View, Text, Textarea } from '@tarojs/components'
import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import './index.scss'

type OpinionItem = {
  id: string
  userId?: string
  userName?: string
  content: string
  createdAt: string
}

export default function OpinionsPage() {
  const router = useRouter()
  const fromScores = router.params.from === 'scores'
  const user = useAuthStore((s) => s.user)
  const isSecretary = user?.role === 'secretary' || user?.role === 'admin'
  const [items, setItems] = useState<OpinionItem[]>([])
  const [orgName, setOrgName] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const tabPath = isSecretary ? '/pages/scores/index' : undefined

  async function load() {
    setLoading(true)
    setError(null)
    try {
      if (isSecretary) {
        const data = await apiFetch<{ orgName: string; items: OpinionItem[] }>('/api/opinions/branch')
        setOrgName(data.orgName)
        setItems(data.items ?? [])
      } else {
        const data = await apiFetch<OpinionItem[]>('/api/opinions/mine')
        setItems(data ?? [])
      }
    } catch (e: any) {
      setError(e?.message ?? '内容加载失败，请您稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [isSecretary])

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch('/api/opinions', {
        method: 'POST',
        body: JSON.stringify({ content: content.trim() }),
      })
      setContent('')
      Taro.showToast({ title: '已提交，感谢您的反馈', icon: 'success' })
      await load()
    } catch (e: any) {
      setError(e?.message ?? '提交未成功，请您稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell tabPath={tabPath} requireAuth allowAdmin={isSecretary}>
      {fromScores && isSecretary && (
        <Text className="op-back" onClick={() => Taro.navigateBack()}>
          ← 请返回
        </Text>
      )}

      {isSecretary ? (
        <>
          <Text className="m-title">学习意见</Text>
          <Text className="m-sub">{orgName ? `${orgName} · 党员提交的学习体会` : '本支部党员学习意见'}</Text>
        </>
      ) : (
        <>
          <Text className="m-title">向书记提学习意见</Text>
          <Text className="m-sub">欢迎您分享学习体会与建议，书记将予以关注</Text>
          <View className="m-card op-form">
            <Textarea
              className="op-form__input"
              value={content}
              maxlength={500}
              placeholder="请您填写学习体会、困难或建议…"
              onInput={(e) => setContent(e.detail.value)}
            />
            {error && <View className="m-error">{error}</View>}
            <Button loading={submitting} onClick={() => void submit()}>
              {submitting ? '正在提交…' : '请提交意见'}
            </Button>
          </View>
          <Text className="m-section-title">我的提交记录</Text>
        </>
      )}

      {isSecretary && error && <View className="m-error">{error}</View>}

      <View className="op-list">
        {items.map((it) => (
          <View key={it.id} className="m-card op-card">
            {isSecretary && it.userName && (
              <Text className="op-card__author">{it.userName}</Text>
            )}
            <Text className="op-card__content">{it.content}</Text>
            <Text className="op-card__time">{new Date(it.createdAt).toLocaleString()}</Text>
          </View>
        ))}
        {!loading && items.length === 0 && (
          <View className="m-empty">
            {isSecretary ? '暂无党员提交的学习意见' : '您尚未提交过学习意见，欢迎您分享学习体会'}
          </View>
        )}
      </View>
    </PageShell>
  )
}
