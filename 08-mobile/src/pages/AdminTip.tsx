import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuthStore } from '@/store/auth'

export default function AdminTip() {
  const { logout } = useAuthStore()
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[430px] flex-col justify-center gap-4 bg-paper px-6">
      <h1 className="text-2xl font-bold text-ink">请使用 PC 管理端</h1>
      <p className="text-sm leading-6 text-ink/60">
        管理员功能在 PC 网页完成。移动端面向党员与支部书记学习、测验与督促。
      </p>
      <p className="text-sm text-ink/50">PC 地址通常为 http://localhost:5173/</p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            void logout()
          }}
        >
          退出账号
        </Button>
        <Link to="/login">
          <Button>返回登录</Button>
        </Link>
      </div>
    </div>
  )
}
