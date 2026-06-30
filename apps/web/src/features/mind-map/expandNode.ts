// 手動展開（クリックしたノードだけを1回だけ生成・連鎖しない・AC-4）。
// 自動連鎖（startExpansion）とは異なり、対象ノードに対して /api/associations を1回呼び、
// 子を1段だけ追加する。手動モードでのみ作用する（DESIGN §6.2）。
// ストアに fetch を持たせず、ここで API クライアントとストアの純粋アクションを結線する。

import type { AssociateResponse } from '@rensoo/shared'
import { requestAssociations as defaultRequestAssociations } from '../../api-client/associations'
import { ApiError } from '../../api-client/errors'
import { useMindMapStore } from '../../store/mindMapStore'

const FALLBACK_ERROR_MESSAGE = '連想の生成に失敗しました。しばらくして再試行してください。'

export interface ExpandNodeDeps {
  readonly requestAssociations?: (req: {
    input: string
    count: number
  }) => Promise<AssociateResponse>
}

/**
 * 指定ノードを手動展開する（1回だけ・連鎖しない）。
 * - 手動モード以外、生成中、未知ノードは何もしない（多重実行・自動連鎖との競合を防ぐ）。
 * - 取得した連想語を `appendChildren` で子として取り込む（重複/孤立エッジはストアが整合）。
 * - 失敗は握りつぶさず日本語メッセージで status=error。
 */
export const expandNode = async (nodeId: string, deps: ExpandNodeDeps = {}): Promise<void> => {
  const request = deps.requestAssociations ?? defaultRequestAssociations
  const store = useMindMapStore.getState()

  if (store.mode !== 'manual') return // 手動モードのみ（AC-4）
  if (store.status === 'generating') return // 多重実行防止

  const node = store.nodes.find((n) => n.id === nodeId)
  if (!node) return

  store.setStatus('generating')
  try {
    const { words } = await request({ input: node.text, count: store.settings.countPerNode })
    useMindMapStore.getState().appendChildren(nodeId, words)
    useMindMapStore.getState().setStatus('idle')
  } catch (err) {
    const message = err instanceof ApiError ? err.message : FALLBACK_ERROR_MESSAGE
    useMindMapStore.getState().setError(message)
    if (!(err instanceof ApiError)) {
      console.error('[expandNode] 想定外のエラー', err)
    }
  }
}
