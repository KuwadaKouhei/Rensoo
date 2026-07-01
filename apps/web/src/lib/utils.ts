import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * クラス名を結合し、Tailwind の衝突を後勝ちで解決するユーティリティ（shadcn/ui 規約）。
 * 条件付き（オブジェクト/配列/falsy）を clsx で正規化し、tailwind-merge で重複ユーティリティを解決する。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
