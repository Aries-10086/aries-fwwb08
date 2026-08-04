import Taro from '@tarojs/taro'
import { useAuthStore } from '@/store/auth'

/** After login, jump to the right home by role. */
export function redirectAfterLogin() {
  const role = useAuthStore.getState().user?.role
  if (role === 'admin') {
    Taro.redirectTo({ url: '/pages/admin-tip/index' })
  } else if (role === 'secretary') {
    Taro.redirectTo({ url: '/pages/dashboard/index' })
  } else {
    Taro.redirectTo({ url: '/pages/home/index' })
  }
}
