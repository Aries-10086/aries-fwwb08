import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuthStore } from '@/store/auth'
import { ArrowRight, BookOpen, Brain, ChartBar } from '@phosphor-icons/react'

const features = [
  {
    title: '任务驱动学习',
    desc: '内容按组织精准下发，学习责任与完成情况落到支部、落到人。',
    icon: BookOpen,
  },
  {
    title: '数据化管理',
    desc: '时长、完成率、成绩与通过率统一呈现，管理不再靠口头汇报。',
    icon: ChartBar,
    accent: true,
  },
  {
    title: 'AI 提效决策',
    desc: '推荐、查询、报告三条链路打通，把系统数据变成可执行建议。',
    icon: Brain,
  },
]

const pillars = [
  ['组织治理', '支部、人员、任务、题库统一管理'],
  ['学习闭环', '内容学习、任务派发、考试结果自动串联'],
  ['AI 决策', '推荐、查询、报告三类能力直接落地'],
  ['可追溯档案', '浏览时长与成绩全程留痕'],
]

export default function Home() {
  const { user } = useAuthStore()
  const go = user ? (user.role === 'admin' ? '/admin/dashboard' : '/m/home') : '/login'

  return (
    <div>
      <section className="hero-bleed">
        <div className="hero-atmosphere" aria-hidden>
          <div className="hero-orb hero-orb-a" />
          <div className="hero-orb hero-orb-b" />
          <div className="hero-beam hero-beam-a" />
          <div className="hero-beam hero-beam-b" />
          <div className="hero-beam hero-beam-c" />
          <div className="hero-particles">
            {Array.from({ length: 18 }, (_, i) => (
              <span key={i} className={`hero-particle hero-particle-${i + 1}`} />
            ))}
          </div>
          <div className="hero-noise" />
          <div className="hero-vignette" />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-20 text-center md:py-28">
          <p className="rise-in text-sm font-medium text-white/70">组织学习的数智中枢</p>
          <h1 className="brand-mark rise-in rise-in-delay-1 mt-5 text-6xl text-white md:text-8xl lg:text-[7rem]">
            数智党校
          </h1>
          <div className="rise-in rise-in-delay-2 mt-10 flex flex-wrap items-center justify-center gap-3">
            <div className="btn-glow-border">
              <Link to={go} className="btn-glow-border-inner">
                {user ? '进入系统' : '账号登录'}
                <ArrowRight size={18} weight="bold" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6">
        <section className="section-block">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-[#12151c] md:text-3xl">
              一条闭环，贯通学习与治理
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map((it, i) => {
              const Icon = it.icon
              return (
                <div
                  key={it.title}
                  className={`feature-tile rise-in ${it.accent ? 'feature-tile-accent' : ''}`}
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
                  <p className="mt-2 text-sm leading-7 text-[rgba(18,21,28,0.62)]">{it.desc}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="section-block border-t border-[rgba(18,21,28,0.06)]">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-[#12151c] md:text-3xl">
              治理、学习、洞察同屏
            </h2>
          </div>

          <ol className="mt-10 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map(([title, desc], index) => (
              <li key={title} className="feature-tile">
                <span className="text-2xl font-semibold tabular-nums text-[#9e1b2b]/50">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="mt-3 text-base font-semibold tracking-tight text-[#12151c]">{title}</div>
                <div className="mt-1 text-sm leading-6 text-[rgba(18,21,28,0.55)]">{desc}</div>
              </li>
            ))}
          </ol>
        </section>

        <section className="section-block border-t border-[rgba(18,21,28,0.06)] pb-16 md:pb-20">
          <div className="cta-band text-center">
            <div
              className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 text-[8rem] font-bold leading-none text-[#9e1b2b]/[0.06] md:text-[11rem]"
              aria-hidden
            >
              学
            </div>
            <h2 className="relative mx-auto max-w-xl text-2xl font-semibold tracking-tight text-[#12151c] md:text-3xl">
              进入数智党校
            </h2>
            <div className="relative mt-7 flex justify-center">
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
