// 汎用ボタン（既存 API を保ったまま shadcn/ui Button へ委譲）。
// 既存呼び出し（variant='primary'|'secondary'）を壊さないための互換ラッパ。
// 新規実装は `@/components/ui/button` を直接使ってよい（T18 以降で段階移行）。
import type { ButtonHTMLAttributes } from 'react'
import { Button as UiButton } from '@/components/ui/button'

export type ButtonVariant = 'primary' | 'secondary'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
}

/**
 * type 既定は 'button'（フォーム誤送信を防ぐ）。
 * 旧 variant を shadcn のバリアントに写像（primary→default / secondary→secondary）。
 */
export const Button = ({ variant = 'primary', type = 'button', ...rest }: ButtonProps) => (
  <UiButton variant={variant === 'primary' ? 'default' : 'secondary'} type={type} {...rest} />
)
