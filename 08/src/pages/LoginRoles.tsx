import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { useAuthStore, type UserRole } from '@/store/auth'
import { Shield, User, Users } from 'lucide-react'

const roles: { role: UserRole; title: string; desc: string; icon: any }[] = [
  { role: 'member', title: '党员', desc: '学习任务、公共内容、测验考试、AI 推荐与报告', icon: User },
  { role: 'secretary', title: '支部书记', desc: '学习与测验参与 + 本支部数据查看（演示）', icon: Users },
  { role: 'admin', title: '系统管理员', desc: '组织/人员/内容/任务/题库/试卷/测验/统计/AI 查询', icon: Shield },
]

export default function LoginRoles() {
  const nav = useNavigate()
  const { login } = useAuthStore()
  const [loadingRole, setLoadingRole] = useState<UserRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onLogin(role: UserRole) {
    setError(null)
    setLoadingRole(role)
    try {
      await login(role)
      nav(role === 'admin' ? '/admin/dashboard' : '/m/home')
    } catch (e: any) {
      setError(e?.message ?? '登录失败')
    } finally {
      setLoadingRole(null)
    }
  }

  return (
    <div className="grid gap-6 md:gap-8">
      <section className="hero-frame px-6 py-8 md:px-10">
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <div className="page-eyebrow">Access Gateway</div>
            <h1 className="page-title md:text-6xl">选择身份，进入统一学习中枢。</h1>
            <p className="page-subtitle max-w-2xl">
              演示环境提供党员、支部书记、系统管理员三类入口。前台聚焦学习与测验，后台聚焦治理与洞察，视觉上保持同一套庄重、清晰的系统语言。
            </p>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {[
                ['党员端', '学习内容、测验考试、AI 推荐与报告'],
                ['支部视角', '参与学习与查看本支部数据演示'],
                ['管理中枢', '组织、题库、统计与 AI 查询统一管理'],
              ].map(([title, desc]) => (
                <div key={title} className="panel-muted rounded-2xl px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.28em] text-[#8c2424]/65">{title}</div>
                  <div className="mt-2 text-sm leading-6 text-black/70">{desc}</div>
                </div>
              ))}
            </div>
            {error && (
              <div className="mt-6 rounded-2xl bg-[#b91c1c]/10 px-4 py-3 text-[#7f1d1d] shadow-[inset_0_0_0_1px_rgba(185,28,28,0.16)]">
                {error}
              </div>
            )}
          </div>
          <div className="md:col-span-5">
            <div className="list-surface h-full">
              <div className="text-xs uppercase tracking-[0.32em] text-[#8c2424]/65">Identity Routing</div>
              <div className="mt-4 decorative-rule" />
              <div className="mt-5 grid gap-4">
                <div>
                  <div className="metric-value">3</div>
                  <div className="mt-1 text-sm text-black/70">预设身份入口</div>
                </div>
                <div>
                  <div className="metric-value">1</div>
                  <div className="mt-1 text-sm text-black/70">套统一品牌界面语言</div>
                </div>
                <div>
                  <div className="metric-value">24h</div>
                  <div className="mt-1 text-sm text-black/70">随时切换角色查看系统闭环</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {roles.map((r) => {
          const Icon = r.icon
          const isLoading = loadingRole === r.role
          return (
            <Card key={r.role} className="group relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-[#8c2424]" />
                    {r.title}
                  </CardTitle>
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#8c2424]/5 shadow-[inset_0_0_0_1px_rgba(140,36,36,0.14)]">
                    <span className="text-xs text-[#8c2424]/70">0{roles.findIndex((item) => item.role === r.role) + 1}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm leading-7 text-black/70">{r.desc}</div>
                <Button className="mt-5 w-full" onClick={() => onLogin(r.role)} disabled={!!loadingRole}>
                  {isLoading ? '登录中…' : '进入'}
                </Button>
              </CardContent>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#b91c1c]/10 to-transparent opacity-0 transition group-hover:opacity-100" />
            </Card>
          )
        })}
      </div>
    </div>
  )
}

