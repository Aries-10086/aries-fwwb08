import { View, Text, Input } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { useAuthStore } from '@/store/auth'
import { redirectAfterLogin } from '@/utils/nav'
import './index.scss'

export default function LoginPage() {
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) redirectAfterLogin()
  }, [user])

  async function onSubmit() {
    setError(null)
    setLoading(true)
    try {
      await login(username.trim(), password)
      redirectAfterLogin()
    } catch (err: any) {
      setError(err?.message ?? '登录未成功，请您核对账号密码后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="login">
      <View className="login__hero">
        <Text className="login__eyebrow">移动学习</Text>
        <Text className="login__title">数智党校</Text>
        <Text className="login__desc">任务 · 测验 · 报告 · 随身学</Text>
      </View>

      <View className="login__card">
        <Text className="login__card-title">欢迎您登录</Text>
        <View className="login__field">
          <Text className="login__label">账号</Text>
          <Input
            className="m-input login__input"
            value={username}
            placeholder="请输入您的账号"
            placeholderStyle="color:#9aa0a6;font-size:16px;line-height:48px;"
            onInput={(e) => setUsername(e.detail.value)}
          />
        </View>
        <View className="login__field">
          <Text className="login__label">密码</Text>
          <Input
            className="m-input login__input"
            password
            value={password}
            placeholder="请输入您的密码"
            placeholderStyle="color:#9aa0a6;font-size:16px;line-height:48px;"
            onInput={(e) => setPassword(e.detail.value)}
          />
        </View>
        {error && <View className="m-error">{error}</View>}
        <View className="login__actions">
          <Button loading={loading} onClick={() => void onSubmit()}>
            {loading ? '正在登录…' : '请进入学习'}
          </Button>
        </View>
        <Text className="login__tip">请您知悉：本端面向党员与支部书记，管理后台请使用 PC 端</Text>
      </View>
    </View>
  )
}
