// 自走展開フローのオーケストレーション（SSE 受信→ストア反映・AC-3,6,12）。
// ストアに fetch を持たせず、ここで SSE クライアントとストアの純粋アクションを結線する。
// SSE クライアントは注入可能にして、ストア実物＋クライアントスタブで決定的にテストする（TEST_PHILOSOPHY）。

import type { ExpansionStopReason } from '@rensoo/shared'
import {
  streamExpansion as defaultStreamExpansion,
  type ExpansionStreamHandlers,
} from '../../api-client/expansion'
import { ApiError } from '../../api-client/errors'
import { useMindMapStore } from '../../store/mindMapStore'

/** 停止理由のユーザー向け日本語メッセージ（AC-3 表示）。 */
export const STOP_REASON_MESSAGE: Record<ExpansionStopReason, string> = {
  max_depth: '最大の深さに達したため展開を停止しました。',
  max_nodes: 'ノード数の上限に達したため展開を停止しました。',
  user_stop: '展開を停止しました。',
  completed: '展開が完了しました。',
}

const FALLBACK_ERROR_MESSAGE = '自走展開に失敗しました。しばらくして再試行してください。'

export interface RunExpansionFlowDeps {
  /** SSE クライアント（既定は実装。テストでスタブ注入）。 */
  readonly streamExpansion?: typeof defaultStreamExpansion
  /** 中断シグナル（停止ボタン→接続クローズ）。 */
  readonly signal?: AbortSignal
}

/**
 * 起点キーワードから自走展開を開始する。
 * - 空入力は日本語エラー。
 * - 既存マップをクリア（設定・モードは保持）し生成中表示。
 * - SSE: node-batch を取り込み、stopped で停止理由＋idle、error で日本語エラー。
 * - 接続クローズ（停止）で stopped が来ない場合は user_stop として確定する（AC-6）。
 */
export const startExpansion = async (
  keyword: string,
  deps: RunExpansionFlowDeps = {},
): Promise<void> => {
  const stream = deps.streamExpansion ?? defaultStreamExpansion
  const text = keyword.trim()
  if (!text) {
    useMindMapStore.getState().setError('キーワードを入力してください。')
    return
  }

  const store = useMindMapStore.getState()
  store.clearMap()
  store.setStatus('generating')
  const settings = useMindMapStore.getState().settings

  const handlers: ExpansionStreamHandlers = {
    onNodeBatch: (batch) => useMindMapStore.getState().applyExpansionBatch(batch),
    onStopped: (stopped) => {
      const current = useMindMapStore.getState()
      current.setStopReason(stopped.reason)
      // error 受信済みのときは error 表示を維持する（stopped で上書きしない）。
      if (current.status !== 'error') {
        current.setStatus('idle')
      }
    },
    onError: (error) => useMindMapStore.getState().setError(error.message),
  }

  try {
    await stream({ rootInput: text, settings }, handlers, deps.signal)
    // 接続クローズ（停止）で stopped 未受信なら user_stop として確定する。
    const after = useMindMapStore.getState()
    if (after.status === 'generating') {
      after.setStopReason('user_stop')
      after.setStatus('idle')
    }
  } catch (err) {
    const message = err instanceof ApiError ? err.message : FALLBACK_ERROR_MESSAGE
    useMindMapStore.getState().setError(message)
    if (!(err instanceof ApiError)) {
      console.error('[startExpansion] 想定外のエラー', err)
    }
  }
}
