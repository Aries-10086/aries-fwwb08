import { View, Text, Input } from '@tarojs/components'
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import './index.scss'

type MyCenter = {
  profile: {
    name: string
    username: string
    role: string
    orgName: string
    createdAt: string | null
  }
  learning: { durationHours: number; completedContentCount: number }
  exams: { attemptCount: number; avgScore: number | null; passCount: number }
}

const roleLabel: Record<string, string> = {
  member: '党员',
  secretary: '支部书记',
  admin: '管理员',
}

export default function AccountPage() {
  const logout = useAuthStore((s) => s.logout)
  const [data, setData] = useState<MyCenter | null>(null)
  const [pwd, setPwd] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setData(await apiFetch<MyCenter>('/api/stats/my-center'))
      } catch (e: any) {
        setErr(e?.message ?? '加载失败')
      }
    })()
  }, [])

  async function changePassword() {
    setMsg(null)
    setErr(null)
    if (pwd.newPassword !== pwd.confirmPassword) {
      setErr('两次新密码不一致')
      return
    }
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: pwd.oldPassword,
          newPassword: pwd.newPassword,
        }),
      })
      setMsg('密码已更新')
      setPwd({ oldPassword: '', newPassword: '', confirmPassword: '' })
    } catch (e: any) {
      setErr(e?.message ?? '改密失败')
    }
  }

  const p = data?.profile

  return (
    <PageShell tabPath="/pages/account/index">
      <Text className="m-title">我的</Text>
      {p && (
        <View className="m-card account-profile">
          {[
            ['姓名', p.name],
            ['账号', p.username],
            ['角色', roleLabel[p.role] ?? p.role],
            ['支部', p.orgName],
          ].map(([k, v]) => (
            <View key={k} className="account-row">
              <Text className="account-row__k">{k}</Text>
              <Text className="account-row__v">{v}</Text>
            </View>
          ))}
        </View>
      )}

      {data && (
        <View className="account-stats">
          {[
            ['时长', `${data.learning.durationHours}h`],
            ['完成', `${data.learning.completedContentCount}`],
            ['均分', data.exams.avgScore ?? '-'],
          ].map(([k, v]) => (
            <View key={k} className="m-card account-stat">
              <Text className="account-stat__k">{k}</Text>
              <Text className="account-stat__v">{v}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="m-card account-pwd">
        <Text className="account-pwd__title">修改密码</Text>
        {(
          [
            ['oldPassword', '原密码'],
            ['newPassword', '新密码'],
            ['confirmPassword', '确认新密码'],
          ] as const
        ).map(([key, label]) => (
          <Input
            key={key}
            className="m-input account-pwd__input"
            password
            placeholder={label}
            value={pwd[key]}
            onInput={(e) => setPwd((s) => ({ ...s, [key]: e.detail.value }))}
          />
        ))}
        {err && <Text className="seal" style={{ fontSize: '13px' }}>{err}</Text>}
        {msg && <Text className="ok" style={{ fontSize: '13px' }}>{msg}</Text>}
        <Button onClick={() => void changePassword()}>确认改密</Button>
      </View>

      <View className="account-logout">
        <Button
          variant="danger"
          onClick={async () => {
            await logout()
            Taro.redirectTo({ url: '/pages/login/index' })
          }}
        >
          退出登录
        </Button>
      </View>
    </PageShell>
  )
}
