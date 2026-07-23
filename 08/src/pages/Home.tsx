import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuthStore } from '@/store/auth'
import { ArrowRight, BarChart3, BookOpen, BrainCircuit } from 'lucide-react'

export default function Home() {
  const { user } = useAuthStore()
  const go = user ? (user.role === 'admin' ? '/admin/dashboard' : '/m/home') : '/login'

  return (
    <div>
      {/* 首屏：品牌 + 一句标题 + 一句支持文 + CTA + 主视觉平面 */}
      <section className="hero-bleed">
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-16 pt-24 md:pb-20 md:pt-28">
          <p className="rise-in text-[12px] font-semibold tracking-[0.35em] text-white/70">
            组织学习的数智中枢
          </p>
          <h1 className="brand-mark rise-in rise-in-delay-1 mt-5 text-5xl text-white md:text-7xl lg:text-8xl">
            数智党校
          </h1>
          <p className="rise-in rise-in-delay-2 mt-5 max-w-xl text-base leading-8 text-white/80 md:text-lg">
            让组织学习有章法，让数据洞察有分量。
          </p>
          <div className="rise-in rise-in-delay-3 mt-10 flex flex-wrap items-center gap-3">
            <Link to={go}>
              <Button className="bg-white px-7 text-[#a31828] shadow-none hover:bg-white/92">
                {user ? '进入系统' : '账号登录'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {!user && (
              <Link to="/register">
                <Button className="border border-white/35 bg-transparent px-6 text-white shadow-none hover:bg-white/12 hover:text-white">
                  注册账号
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6">
        <section className="section-block">
          <p className="section-kicker rise-in">能力主线</p>
          <h2 className="mt-3 font-serif text-3xl font-bold tracking-wide text-[#0e1116] md:text-4xl">
            一条闭环，贯通学习与治理
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[rgba(14,17,22,0.65)]">
            从内容下发到测验评估，再到 AI 辅助决策，把组织要求落到人、落到数据。
          </p>

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                title: '任务驱动学习',
                desc: '内容按组织精准下发，学习责任与完成情况落到支部、落到人。',
                icon: BookOpen,
              },
              {
                title: '数据化管理',
                desc: '时长、完成率、成绩与通过率统一呈现，管理不再靠口头汇报。',
                icon: BarChart3,
              },
              {
                title: 'AI 提效决策',
                desc: '推荐、查询、报告三条链路打通，把系统数据变成可执行建议。',
                icon: BrainCircuit,
              },
            ].map((it, i) => {
              const Icon = it.icon
              return (
                <div
                  key={it.title}
                  className="group border-t-2 border-[#a31828] pt-5"
                  style={{ animationDelay: `${0.1 + i * 0.08}s` }}
                >
                  <Icon className="h-5 w-5 text-[#a31828]" />
                  <h3 className="mt-4 font-serif text-xl font-bold tracking-wide text-[#0e1116]">
                    {it.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[rgba(14,17,22,0.65)]">{it.desc}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="section-block border-t border-[rgba(14,17,22,0.08)]">
          <div className="grid gap-10 md:grid-cols-12 md:items-end">
            <div className="md:col-span-5">
              <p className="section-kicker">系统能力</p>
              <h2 className="mt-3 font-serif text-3xl font-bold tracking-wide text-[#0e1116] md:text-4xl">
                治理、学习、洞察同屏
              </h2>
              <p className="mt-3 text-sm leading-7 text-[rgba(14,17,22,0.65)]">
                管理员把握全局，党员完成学习，支部书记掌握成绩——角色清晰，路径分明。
              </p>
            </div>
            <div className="md:col-span-7">
              <ol className="grid gap-0">
                {[
                  ['组织治理', '支部、人员、任务、题库统一管理'],
                  ['学习闭环', '内容学习、任务派发、考试结果自动串联'],
                  ['AI 决策', '推荐、查询、报告三类能力直接落地'],
                  ['可追溯档案', '浏览时长与成绩全程留痕'],
                ].map(([title, desc], index) => (
                  <li
                    key={title}
                    className="flex items-baseline gap-5 border-b border-[rgba(14,17,22,0.08)] py-4 first:pt-0 last:border-0"
                  >
                    <span className="font-display text-2xl text-[#a31828]/40">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <div className="font-serif text-lg font-bold tracking-wide text-[#0e1116]">
                        {title}
                      </div>
                      <div className="mt-1 text-sm text-[rgba(14,17,22,0.6)]">{desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="section-block border-t border-[rgba(14,17,22,0.08)] pb-16 md:pb-20">
          <div className="relative overflow-hidden bg-[#0e1116] px-8 py-12 text-white md:px-12 md:py-14">
            <div
              className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 font-display text-[10rem] leading-none text-white/[0.06] md:text-[14rem]"
              aria-hidden
            >
              学
            </div>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-[#c9a84c]/80">即刻开始</p>
            <h2 className="mt-4 max-w-xl font-serif text-3xl font-bold tracking-wide md:text-4xl">
              进入数智党校，完成当期学习与治理
            </h2>
            <div className="mt-8">
              <Link to={go}>
                <Button className="bg-[#a31828] px-7 hover:bg-[#8a1422]">
                  {user ? '继续工作台' : '登录系统'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
