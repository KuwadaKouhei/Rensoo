// 自走展開の開始/停止を扱う React フック（DESIGN §6.2/§6.5）。
// 停止は AbortController で SSE 接続を閉じ、サーバー側 BFS も止める（AC-6）。
// 状態更新はフロー（startExpansion）とストアに委譲し、フック自体はロジックを持たない。

import { useCallback, useEffect, useRef } from 'react'
import { startExpansion } from './runExpansionFlow'

export interface UseExpansionStream {
  /** 起点キーワードで自走展開を開始する（実行中なら前の接続を閉じる）。 */
  readonly start: (keyword: string) => void
  /** 実行中の展開を停止する（接続クローズ）。 */
  readonly stop: () => void
}

export const useExpansionStream = (): UseExpansionStream => {
  const controllerRef = useRef<AbortController | null>(null)

  const start = useCallback((keyword: string) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    void startExpansion(keyword, { signal: controller.signal })
  }, [])

  const stop = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  // アンマウント時に進行中の接続を閉じる（リーク防止）。
  useEffect(() => () => controllerRef.current?.abort(), [])

  return { start, stop }
}
