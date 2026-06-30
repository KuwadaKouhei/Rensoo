// 「作成」フローのオーケストレーション（キーワード→単発生成→描画・縦貫通 / AC-1,2,12）。
// ストア（純粋なドメイン中核）に fetch を持たせず、ここで API クライアントとストアアクションを結線する。
// API 境界（requestAssociations）は注入可能にして、ストア実物＋API スタブで決定的にテストできるようにする
//（TEST_PHILOSOPHY: 外部依存はスタブ・主要フローは統合テスト）。

import type { AssociateResponse } from '@rensoo/shared'
import { requestAssociations as defaultRequestAssociations } from '../../api-client/associations'
import { ApiError } from '../../api-client/errors'
import { useMindMapStore } from '../../store/mindMapStore'

/** フロー失敗時の汎用日本語メッセージ（ApiError 以外の想定外エラー用）。 */
const FALLBACK_ERROR_MESSAGE = '連想の生成に失敗しました。しばらくして再試行してください。'

export interface CreateAssociationMapDeps {
  /** 連想生成 API 呼び出し（既定は実クライアント。テストでスタブ注入）。 */
  readonly requestAssociations?: (req: {
    input: string
    count: number
  }) => Promise<AssociateResponse>
}

/**
 * 起点キーワードから連想マップを作る。
 * 1) キーワード検証（空は日本語エラー） 2) 起点ノード生成 3) 生成中表示
 * 4) API で連想語取得（件数は現在の生成設定に追従・AC-2） 5) 子ノード＋エッジ取り込み
 * 失敗は握りつぶさず、ApiError の日本語メッセージ（なければ汎用文）をストアに反映する（AC-12）。
 */
export const createAssociationMap = async (
  keyword: string,
  deps: CreateAssociationMapDeps = {},
): Promise<void> => {
  const requestAssociations = deps.requestAssociations ?? defaultRequestAssociations
  const store = useMindMapStore.getState()

  const text = keyword.trim()
  if (!text) {
    store.setError('キーワードを入力してください。')
    return
  }

  // 起点を即時表示してから生成中状態へ（起点が先に見えることで体感を良くする）。
  store.startNewMap(text)
  useMindMapStore.getState().setStatus('generating')

  try {
    const count = useMindMapStore.getState().settings.countPerNode
    const { words } = await requestAssociations({ input: text, count })
    useMindMapStore.getState().appendChildren('n1', words)
    useMindMapStore.getState().setStatus('idle')
  } catch (err) {
    const message = err instanceof ApiError ? err.message : FALLBACK_ERROR_MESSAGE
    useMindMapStore.getState().setError(message)
    // 想定外（非 ApiError）はログに残して再スローはしない（UI で再試行可能にするため状態に反映済み）。
    if (!(err instanceof ApiError)) {
      console.error('[createAssociationMap] 想定外のエラー', err)
    }
  }
}
