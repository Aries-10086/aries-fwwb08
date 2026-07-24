import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuthStore } from '@/store/auth'
import { ArrowRight, BookOpen, Brain, ChartBar } from '@phosphor-icons/react'

const features = [
  {
    title: '任务驱动学习',
    desc: '内容按组织精准下发，学习责任与完成情况落到支部、落到人。',
    icon: BookOpen,
    span: 'md:col-span-7',
    accent: false,
  },
  {
    title: '数据化管理',
    desc: '时长、完成率、成绩与通过率统一呈现，管理不再靠口头汇报。',
    icon: ChartBar,
    span: 'md:col-span-5',
    accent: true,
  },
  {
    title: 'AI 提效决策',
    desc: '推荐、查询、报告三条链路打通，把系统数据变成可执行建议。',
    icon: Brain,
    span: 'md:col-span-12',
    accent: false,
  },
]

export default function Home() {
  const { user } = useAuthStore()
  const go = user ? (user.role === 'admin' ? '/admin/dashboard' : '/m/home') : '/login'

  return (
    <div>
      <section className="hero-bleed">
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-14 pt-16 md:pb-16 md:pt-20">
          <p className="rise-in text-sm font-medium text-white/70">组织学习的数智中枢</p>
          <h1 className="brand-mark rise-in rise-in-delay-1 mt-4 text-4xl text-white md:text-6xl lg:text-7xl">
            数智党校
          </h1>
          <p className="rise-in rise-in-delay-2 mt-4 max-w-xl text-base leading-7 text-white/80 md:text-lg">
            让组织学习有章法，让数据洞察有分量。
          </p>
          <div className="rise-in rise-in-delay-3 mt-9 flex flex-wrap items-center gap-3">
            <Link to={go}>
              <Button className="rounded-[10px] bg-white px-7 text-[#9e1b2b] shadow-none hover:bg-white/92">
                {user ? '进入系统' : '账号登录'}
                <ArrowRight size={16} weight="bold" />
              </Button>
            </Link>
            {!user && (
              <Link to="/register">
                <Button className="rounded-[10px] border border-white/35 bg-transparent px-6 text-white shadow-none hover:bg-white/12 hover:text-white">
                  注册账号
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6">
        <section className="section-block">
          <h2 className="text-2xl font-semibold tracking-tight text-[#12151c] md:text-3xl">
            一条闭环，贯通学习与治理
          </h2>
          <p className="mt-3 max-w-[65ch] text-sm leading-7 text-[rgba(18,21,28,0.62)]">
            从内容下发到测验评估，再到 AI 辅助决策，把组织要求落到人、落到数据。
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-12">
            {features.map((it, i) => {
              const Icon = it.icon
              return (
                <div
                  key={it.title}
                  className={`feature-tile rise-in ${it.accent ? 'feature-tile-accent' : ''} ${it.span}`}
                  style={{ animationDelay: `${0.06 + i * 0.05}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(158,27,43,0.08)]">
                      <Icon size={20} weight="duotone" className="text-[#9e1b2b]" />
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-[#9e1b2b]/45">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-[#12151c] md:text-xl">
                    {it.title}
                  </h3>
                  <p
                    className={`mt-2 text-sm leading-7 text-[rgba(18,21,28,0.62)] ${
                      it.span === 'md:col-span-12' ? 'max-w-2xl' : ''
                    }`}
                  >
                    {it.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="section-block border-t border-[rgba(18,21,28,0.06)]">
          <h2 className="text-2xl font-semibold tracking-tight text-[#12151c] md:text-3xl">
            治理、学习、洞察同屏
          </h2>
          <p className="mt-3 max-w-[65ch] text-sm leading-7 text-[rgba(18,21,28,0.62)]">
            管理员把握全局，党员完成学习，支部书记掌握成绩。角色清晰，路径分明。
          </p>

          <ol className="feature-rail mt-8">
            {[
              ['组织治理', '支部、人员、任务、题库统一管理'],
              ['学习闭环', '内容学习、任务派发、考试结果自动串联'],
              ['AI 决策', '推荐、查询、报告三类能力直接落地'],
              ['可追溯档案', '浏览时长与成绩全程留痕'],
            ].map(([title, desc], index) => (
              <li key={title} className="feature-rail-item">
                <span className="text-2xl font-semibold tabular-nums text-[#9e1b2b]/50">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <div className="text-base font-semibold tracking-tight text-[#12151c]">{title}</div>
                  <div className="mt-1 text-sm text-[rgba(18,21,28,0.55)]">{desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="section-block border-t border-[rgba(18,21,28,0.06)] pb-16 md:pb-20">
          <div className="cta-band">
            <div
              className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 text-[8rem] font-bold leading-none text-[#9e1b2b]/[0.06] md:text-[11rem]"
              aria-hidden
            >
              学
            </div>
            <h2 className="relative max-w-xl text-2xl font-semibold tracking-tight text-[#12151c] md:text-3xl">
              进入数智党校，完成当期学习与治理
            </h2>
            <p className="relative mt-3 max-w-[50ch] text-sm leading-7 text-[rgba(18,21,28,0.58)]">
              用同一套入口连接管理后台与学习端，减少切换成本。
            </p>
            <div className="relative mt-7">
              <Link to={go}>
                <Button className="px-7">
                  {user ? '继续工作台' : '登录系统'}
                  <ArrowRight size={16} weight="bold" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
