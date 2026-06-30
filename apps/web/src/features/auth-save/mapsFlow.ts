// 保存導線のオーケストレーション（保存/一覧/開く/削除・AC-9,10,11）。
// ストアに fetch を持たせず、ここで maps API クライアント・認証トークン取得・ストアを結線する。
// 依存（client/getToken）は注入可能にして、ストア実物＋スタブで決定的にテストする（TEST_PHILOSOPHY）。

import type { MapSummary, SaveMapRequest, SavedMap } from '@rensoo/shared'
import * as defaultClient from '../../api-client/maps'
import { ApiError } from '../../api-client/errors'
import { getAccessToken as defaultGetAccessToken } from '../../auth/supabaseClient'
import { useMindMapStore } from '../../store/mindMapStore'

/** 保存系フローの結果。`login-required` は未ログイン検知（AC-9）。 */
export type SaveResult =
  | { readonly ok: true; readonly summary: MapSummary }
  | { readonly ok: false; readonly reason: 'login-required' }
  | { readonly ok: false; readonly reason: 'error'; readonly message: string }

export interface MapsFlowDeps {
  readonly client?: {
    listMaps: (token: string) => Promise<readonly MapSummary[]>
    getMap: (token: string, id: string) => Promise<SavedMap>
    saveMap: (token: string, input: SaveMapRequest) => Promise<MapSummary>
    deleteMap: (token: string, id: string) => Promise<void>
  }
  /** アクセストークン取得（未ログインは null）。 */
  readonly getToken?: () => Promise<string | null>
}

const resolveDeps = (deps: MapsFlowDeps) => ({
  client: deps.client ?? defaultClient,
  getToken: deps.getToken ?? defaultGetAccessToken,
})

const messageOf = (err: unknown, fallback: string): string =>
  err instanceof ApiError ? err.message : fallback

/**
 * 現在のマップを保存する。未ログインなら保存せず `login-required` を返す（AC-9）。
 * 成功時はストアの mapId を確定し（以後は上書き）、結果を返す。
 */
export const saveCurrentMap = async (deps: MapsFlowDeps = {}): Promise<SaveResult> => {
  const { client, getToken } = resolveDeps(deps)
  const token = await getToken()
  if (!token) {
    return { ok: false, reason: 'login-required' }
  }

  const s = useMindMapStore.getState()
  if (s.nodes.length === 0) {
    return { ok: false, reason: 'error', message: '保存するマップがありません。' }
  }

  const input: SaveMapRequest = {
    id: s.mapId ?? undefined,
    title: s.title,
    // SaveMapRequest は可変配列を要求するためコピーして渡す（ストアの readonly を侵さない）。
    nodes: [...s.nodes],
    edges: [...s.edges],
    settings: s.settings,
  }

  try {
    const summary = await client.saveMap(token, input)
    useMindMapStore.setState({ mapId: summary.id, title: summary.title })
    return { ok: true, summary }
  } catch (err) {
    return { ok: false, reason: 'error', message: messageOf(err, 'マップの保存に失敗しました。') }
  }
}

/** 保存済みマップ一覧を取得する（未ログインは空配列）。 */
export const fetchMapList = async (deps: MapsFlowDeps = {}): Promise<readonly MapSummary[]> => {
  const { client, getToken } = resolveDeps(deps)
  const token = await getToken()
  if (!token) return []
  return client.listMaps(token)
}

/** 保存済みマップを開いてストアに読み込む（再編集・AC-10）。失敗時は false。 */
export const openMap = async (id: string, deps: MapsFlowDeps = {}): Promise<boolean> => {
  const { client, getToken } = resolveDeps(deps)
  const token = await getToken()
  if (!token) return false
  try {
    const saved = await client.getMap(token, id)
    useMindMapStore.getState().loadMap(saved)
    return true
  } catch (err) {
    const retryable = err instanceof ApiError ? err.retryable : true
    useMindMapStore.getState().setError(messageOf(err, 'マップを開けませんでした。'), retryable)
    return false
  }
}

/** マップを削除する（本人のみ）。削除したのが現在開いているマップなら mapId を解除する。 */
export const deleteMapById = async (id: string, deps: MapsFlowDeps = {}): Promise<boolean> => {
  const { client, getToken } = resolveDeps(deps)
  const token = await getToken()
  if (!token) return false
  try {
    await client.deleteMap(token, id)
    if (useMindMapStore.getState().mapId === id) {
      useMindMapStore.setState({ mapId: null })
    }
    return true
  } catch (err) {
    const retryable = err instanceof ApiError ? err.retryable : true
    useMindMapStore.getState().setError(messageOf(err, 'マップを削除できませんでした。'), retryable)
    return false
  }
}
