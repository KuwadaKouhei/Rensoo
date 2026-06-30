// 連想マップ状態ストア（フロントのドメイン中核・DESIGN §2.1）。
// UI 非依存のプレーン TS として実装し、整合ロジックはモックなしでユニットテストできる純粋関数に切り出す。
// 描画ライブラリ（React Flow）にドメイン状態を握らせない（PLAN_PHILOSOPHY）。

import { create } from 'zustand'
import {
  DEFAULT_GENERATION_SETTINGS,
  type AssociationWord,
  type GenerationSettings,
  type MindMapEdge,
  type MindMapNode,
} from '@rensoo/shared'

/** 展開モード（自動連鎖 / 手動クリック展開のトグル・AC-4）。 */
export type ExpansionMode = 'auto' | 'manual'

/** 連想生成の進行状態（UI のローディング/エラー表示に使う）。 */
export type MapStatus = 'idle' | 'generating' | 'error'

/** ノード/エッジ/ID 採番カウンタをひとまとめにしたマップの素データ（純粋関数の入出力）。 */
export interface MapData {
  readonly nodes: readonly MindMapNode[]
  readonly edges: readonly MindMapEdge[]
  /** ノード ID 採番用の単調増加カウンタ（決定的・テスト容易性のため）。 */
  readonly seq: number
}

/** 起点キーワードから新しいマップ（root ノード1つ）を生成する純粋関数。 */
export const createRootMap = (keyword: string): MapData => {
  const text = keyword.trim()
  if (!text) {
    // 握りつぶさず明示的に失敗させる（CODING_PHILOSOPHY）。呼び出し側（UI）で事前検証する前提。
    throw new Error('起点キーワードが空です')
  }
  const root: MindMapNode = { id: 'n1', text, depth: 0, origin: 'root' }
  return { nodes: [root], edges: [], seq: 1 }
}

/**
 * 親ノードに連想語を子ノード＋エッジとして取り込む純粋関数（整合ロジック・AC-1,2）。
 * - 親が存在しなければ throw（孤立エッジを作らない）。
 * - 既にマップ内に同テキストのノードがあれば取り込まない（重複ノード抑止）。空白語も除外。
 * - 子の depth = 親 depth + 1、origin = 'auto'。エッジ ID は source/target から決定的に決める。
 */
export const appendAssociations = (
  data: MapData,
  parentId: string,
  words: readonly AssociationWord[],
): MapData => {
  const parent = data.nodes.find((n) => n.id === parentId)
  if (!parent) {
    throw new Error(`親ノードが見つかりません: ${parentId}`)
  }

  const existingTexts = new Set(data.nodes.map((n) => n.text))
  const nodes: MindMapNode[] = [...data.nodes]
  const edges: MindMapEdge[] = [...data.edges]
  let seq = data.seq

  for (const { word } of words) {
    const text = word.trim()
    if (!text || existingTexts.has(text)) {
      continue
    }
    existingTexts.add(text)
    seq += 1
    const id = `n${seq}`
    nodes.push({ id, text, depth: parent.depth + 1, origin: 'auto' })
    edges.push({ id: `${parentId}->${id}`, source: parentId, target: id })
  }

  return { nodes, edges, seq }
}

/** ストアの状態とアクション（UI はこのアクション経由でのみ状態を変更する・DESIGN §2.3）。 */
export interface MindMapStore {
  readonly nodes: readonly MindMapNode[]
  readonly edges: readonly MindMapEdge[]
  readonly seq: number
  readonly settings: GenerationSettings
  readonly mode: ExpansionMode
  readonly status: MapStatus
  readonly errorMessage: string | null

  /** 起点キーワードでマップを作り直す（既存マップは破棄）。 */
  startNewMap: (keyword: string) => void
  /** 親ノードへ連想語を子として取り込む。 */
  appendChildren: (parentId: string, words: readonly AssociationWord[]) => void
  /** 展開モード（自動/手動）を切り替える。 */
  setMode: (mode: ExpansionMode) => void
  /** 生成設定を部分更新する。 */
  updateSettings: (patch: Partial<GenerationSettings>) => void
  /** 進行状態を設定する（生成中はエラーをクリア）。 */
  setStatus: (status: MapStatus) => void
  /** エラーメッセージを設定し status を 'error' にする。 */
  setError: (message: string) => void
  /** すべて初期状態に戻す。 */
  reset: () => void
}

interface InitialFields {
  readonly nodes: readonly MindMapNode[]
  readonly edges: readonly MindMapEdge[]
  readonly seq: number
  readonly settings: GenerationSettings
  readonly mode: ExpansionMode
  readonly status: MapStatus
  readonly errorMessage: string | null
}

const initialFields = (): InitialFields => ({
  nodes: [],
  edges: [],
  seq: 0,
  settings: DEFAULT_GENERATION_SETTINGS,
  mode: 'auto',
  status: 'idle',
  errorMessage: null,
})

export const useMindMapStore = create<MindMapStore>((set, get) => ({
  ...initialFields(),

  startNewMap: (keyword) => {
    const next = createRootMap(keyword)
    set({ nodes: next.nodes, edges: next.edges, seq: next.seq, status: 'idle', errorMessage: null })
  },

  appendChildren: (parentId, words) => {
    const { nodes, edges, seq } = get()
    const next = appendAssociations({ nodes, edges, seq }, parentId, words)
    set({ nodes: next.nodes, edges: next.edges, seq: next.seq })
  },

  setMode: (mode) => set({ mode }),

  updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

  setStatus: (status) =>
    set({ status, errorMessage: status === 'error' ? get().errorMessage : null }),

  setError: (message) => set({ status: 'error', errorMessage: message }),

  reset: () => set({ ...initialFields() }),
}))
