import { Navigate } from 'react-router-dom'

/** 已改为账号密码登录，旧「选身份」入口重定向到登录页 */
export default function LoginRoles() {
  return <Navigate to="/login" replace />
}
