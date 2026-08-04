import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/Button'
import { useAuthStore } from '@/store/auth'
import './index.scss'

export default function AdminTipPage() {
  const logout = useAuthStore((s) => s.logout)

  return (
    <View className="admin-tip">
      <Text className="m-title">请使用 PC 管理端</Text>
      <Text className="admin-tip__desc">
        管理员功能在 PC 网页完成。小程序面向党员与支部书记学习、测验与督促。
      </Text>
      <Text className="m-sub">PC 地址通常为 http://localhost:5173/</Text>
      <View className="admin-tip__actions">
        <Button
          variant="secondary"
          onClick={async () => {
            await logout()
            Taro.redirectTo({ url: '/pages/login/index' })
          }}
        >
          退出账号
        </Button>
        <Button onClick={() => Taro.redirectTo({ url: '/pages/login/index' })}>返回登录</Button>
      </View>
    </View>
  )
}
