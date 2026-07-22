import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card, CardContent } from '@/components/Card'
import { useAuthStore } from '@/store/auth'
import { BarChart3, BrainCircuit, BookOpen, ShieldCheck } from 'lucide-react'

export default function Home() {
  const { user } = useAuthStore()

  const go = user ? (user.role === 'admin' ? '/admin/dashboard' : '/m/home') : '/login'

  return (
    <div className="grid gap-8 md:gap-10">
      <section className="hero-frame px-6 py-8 md:px-10 md:py-10">
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <div className="page-eyebrow">
              <ShieldCheck className="h-4 w-4" />
              党校学习双端系统 · 可追溯 · 可解释 · 可治理
            </div>
            <h1 className="page-title max-w-4xl md:text-6xl">
              让组织学习有章法，
              <span className="block text-[#8c2424]">让数据洞察有分量。</span>
            </h1>
            <p className="page-subtitle max-w-2xl">
              围绕组织管理、学习任务、测验考试、统计分析与 AI 能力构建完整闭环，既有庄重的品牌气质，也有面向日常运营的数智效率。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={go}>
                <Button className="px-6">进入系统</Button>
              </Link>
              <Link to="/login/roles">
                <Button variant="secondary" className="px-6">
                  切换身份
                </Button>
              </Link>
            </div>
            <div className="mt-8 grid gap-3 text-sm md:grid-cols-3">
              {[
                ['组织治理', '支部、人员、任务、题库统一管理'],
                ['学习闭环', '内容学习、任务派发、考试结果自动串联'],
                ['AI 决策', '推荐、查询、报告三类能力直接落地'],
              ].map(([title, desc]) => (
                <div key={title} className="panel-muted rounded-2xl px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.28em] text-[#8c2424]/70">{title}</div>
                  <div className="mt-2 text-sm leading-6 text-black/70">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-5">
            <Card className="h-full">
              <CardContent className="pt-6">
                <div className="text-xs uppercase tracking-[0.32em] text-[#8c2424]/70">Capability Matrix</div>
                <div className="mt-4 decorative-rule" />
                <div className="mt-5 grid gap-3">
                  {[
                    { k: '学习任务发布', v: '按支部派发内容与截止时间' },
                    { k: '测验考试闭环', v: '组卷、发布、交卷判分' },
                    { k: '组织统计看板', v: '时长、完成率、均分、通过率' },
                    { k: 'AI 推荐', v: '基于薄弱项推荐公共内容' },
                    { k: 'AI 查询', v: '自然语言提问直出结论与图表' },
                    { k: 'AI 报告', v: '评分、评语与改进建议自动生成' },
                  ].map((it, index) => (
                    <div key={it.k} className="list-surface flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#171717]">{it.k}</div>
                        <div className="mt-1 text-xs leading-5 text-black/60">{it.v}</div>
                      </div>
                      <div className="text-xs text-[#8c2424]/70">0{index + 1}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: '任务驱动学习', desc: '内容按组织精准下发，让学习责任和完成情况真正落到人、落到支部。', icon: BookOpen },
          { title: '数据化管理', desc: '学习时长、完成率、成绩与通过率统一呈现，管理不再靠口头汇报。', icon: BarChart3 },
          { title: 'AI 提效决策', desc: '推荐、查询和报告三条链路打通，把系统数据变成可执行建议。', icon: BrainCircuit },
        ].map((it) => {
          const Icon = it.icon
          return (
            <Card key={it.title}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#8c2424]/5 shadow-[inset_0_0_0_1px_rgba(140,36,36,0.14)]">
                    <Icon className="h-5 w-5 text-[#8c2424]" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.3em] text-[#8c2424]/60">Core Module</div>
                    <div className="mt-2 font-[750] tracking-[-0.03em] text-[#171717]">{it.title}</div>
                    <div className="mt-2 text-sm leading-6 text-black/70">{it.desc}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ['组织覆盖', '多角色、多支部统一治理'],
          ['学习档案', '内容浏览与时长全程记录'],
          ['考试评估', '题库、试卷、测验自动串联'],
          ['AI 辅助', '推荐、报告、查询同步协同'],
        ].map(([title, desc]) => (
          <div key={title} className="list-surface">
            <div className="text-xs uppercase tracking-[0.26em] text-[#8c2424]/60">{title}</div>
            <div className="mt-3 text-lg font-bold tracking-[-0.04em] text-[#171717]">{desc}</div>
          </div>
        ))}
      </section>
    </div>
  )
}
