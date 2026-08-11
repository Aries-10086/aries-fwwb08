import { View, Text, Input } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import './index.scss'

type Content = { id: string; type: string; title: string; category: string }
type TaskContent = { id: string; title: string; type: string; isCompleted: boolean }
type Task = {
  id: string
  title: string
  dueAt: string | null
  contents?: TaskContent[]
  progressPercent?: number
  isCompleted?: boolean
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user)
  const [tasks, setTasks] = useState<Task[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [q, setQ] = useState('')
  const [rec, setRec] = useState<Content[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load(search = '') {
    setError(null)
    try {
      const qParam = search.trim() ? `&q=${encodeURIComponent(search.trim())}` : ''
      const [t, c] = await Promise.all([
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<Content[]>(`/api/contents?isPublic=1${qParam}`),
      ])
      setTasks(t)
      setContents(c)
      if (!search.trim()) {
        try {
          const r = await apiFetch<{ items?: Content[] }>('/api/ai/recommend', {
            method: 'POST',
            body: JSON.stringify({ userId: user?.id }),
          })
          setRec(r.items ?? [])
        } catch {
          setRec([])
        }
      }
    } catch (e: any) {
      setError(e?.message ?? '内容加载失败，请您稍后重试')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const openTasks = useMemo(() => tasks.filter((t) => !t.isCompleted).slice(0, 5), [tasks])

  return (
    <PageShell tabPath="/pages/home/index">
      <Text className="seal" style={{ fontSize: '12px', fontWeight: 500 }}>
        您好，{user?.name}同志
      </Text>
      <Text className="m-title" style={{ display: 'block', marginTop: '4px' }}>
        今日学习
      </Text>

      <View className="home-search">
        <Input
          className="m-input home-search__input"
          value={q}
          placeholder="请搜索学习内容"
          onInput={(e) => setQ(e.detail.value)}
        />
        <Button className="home-search__btn" onClick={() => void load(q)}>
          请搜索
        </Button>
      </View>

      {error && <View className="m-error">{error}</View>}

      <Text className="m-section-title">学习任务</Text>
      <View className="home-list">
        {openTasks.map((t) => {
          const next = t.contents?.find((c) => !c.isCompleted)
          return (
            <View key={t.id} className="m-card home-card">
              <View className="home-card__row">
                <View className="home-card__main">
                  <Text className="home-card__title">{t.title}</Text>
                  <Text className="home-card__meta">
                    进度 {t.progressPercent ?? 0}%
                    {t.dueAt ? ` · 截止 ${new Date(t.dueAt).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                {next && (
                  <Button
                    className="home-card__btn"
                    onClick={() =>
                      Taro.navigateTo({ url: `/pages/content/detail/index?id=${next.id}` })
                    }
                  >
                    请继续学习
                  </Button>
                )}
              </View>
            </View>
          )
        })}
        {openTasks.length === 0 && <View className="m-empty">暂无未完成任务，感谢您的认真完成</View>}
      </View>

      {!q.trim() && rec.length > 0 && (
        <>
          <Text className="m-section-title">为您推荐</Text>
          <View className="home-list">
            {rec.slice(0, 4).map((c) => (
              <View
                key={c.id}
                className="m-card home-link"
                onClick={() => Taro.navigateTo({ url: `/pages/content/detail/index?id=${c.id}` })}
              >
                <View>
                  <Text className="home-card__title">{c.title}</Text>
                  <Text className="home-card__meta">{c.category}</Text>
                </View>
                <Text className="seal">›</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text className="m-section-title">{q.trim() ? '搜索结果' : '公共内容'}</Text>
      <View className="home-list">
        {contents.slice(0, 20).map((c) => (
          <View
            key={c.id}
            className="m-card home-link"
            onClick={() => Taro.navigateTo({ url: `/pages/content/detail/index?id=${c.id}` })}
          >
            <View>
              <Text className="home-card__title">{c.title}</Text>
              <Text className="home-card__meta">
                {c.category} · {c.type === 'video' ? '视频' : '文章'}
              </Text>
            </View>
            <Text className="seal">›</Text>
          </View>
        ))}
        {contents.length === 0 && <View className="m-empty">暂无相关内容，请您换个关键词试试</View>}
      </View>
    </PageShell>
  )
}
