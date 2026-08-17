import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-[4px] border border-[rgba(18,21,28,0.08)] bg-white', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-[rgba(18,21,28,0.06)] px-5 py-3.5', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-[15px] font-semibold text-[#12151c]', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}
