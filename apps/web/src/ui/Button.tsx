// 汎用ボタン（UI プリミティブ）。ロジックは持たず、見た目とクリック委譲のみ（DESIGN §2.1）。
import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
}

/** type 既定は 'button'（フォーム誤送信を防ぐ）。variant は将来のスタイル差し替え用の素地。 */
export const Button = ({ variant = 'primary', type = 'button', ...rest }: ButtonProps) => (
  <button type={type} data-variant={variant} {...rest} />
)
