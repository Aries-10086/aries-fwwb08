import { Button as TaroButton, View, Text } from '@tarojs/components'
import type { ITouchEvent } from '@tarojs/components'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import './Button.scss'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

type Props = {
  className?: string
  variant?: Variant
  disabled?: boolean
  loading?: boolean
  children?: ReactNode
  onClick?: (e: ITouchEvent) => void
  formType?: 'submit' | 'reset'
}

export function Button({
  className,
  variant = 'primary',
  disabled,
  loading,
  children,
  onClick,
  formType,
}: Props) {
  return (
    <TaroButton
      className={cn('mp-btn', `mp-btn--${variant}`, className)}
      disabled={disabled || loading}
      loading={loading}
      formType={formType}
      onClick={onClick}
      hoverClass="mp-btn--hover"
    >
      <View className="mp-btn__inner">
        <Text>{children}</Text>
      </View>
    </TaroButton>
  )
}
