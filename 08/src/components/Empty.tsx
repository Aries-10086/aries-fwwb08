import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type EmptyProps = {
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

export default function Empty({
  title = '暂无内容',
  description = '当前没有可展示的数据。完成相关操作后会显示在这里。',
  action,
  className,
}: EmptyProps) {
  return (
    <div className={cn('empty-state', className)}>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(158,27,43,0.08)] text-sm font-semibold text-[#9e1b2b]">
        空
      </div>
      <div className="empty-state-title">{title}</div>
      <p className="empty-state-desc">{description}</p>
      {action}
    </div>
  )
}
