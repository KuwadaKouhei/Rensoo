// 連想マップ状態ストア（フロントのドメイン中核・DESIGN §2.1）。
// UI 非依存のプレーン TS として実装し、整合ロジックはモックなしでユニットテストできる純粋関数に切り出す。
// 描画ライブラリ（React Flow）にドメイン状態を握らせない（PLAN_PHILOSOPHY）。

import { create } from 'zustand'
import {
  DEFAULT_GENERATION_SETTINGS,
  type AssociationWord,
  type ExpansionStopReason,
  type GenerationSettings,
  type MindMapEdge,
  type MindMapNode,
  type SavedMap,
} from '@rensoo/shared'

/** マップの既定タイトル（DB の default と一致させる）。 */
const DEFAULT_TITLE = '無題のマップ'

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

/** 自走展開（SSE）の1バッチ。サーバー採番 id を持つ（DESIGN §6.2・expansionSchema）。 */
export interface ExpansionBatch {
  /** null は起点バッチ（depth=0, origin=root）。 */
  readonly parentId: string | null
  readonly depth: number
  readonly nodes: readonly { readonly id: string; readonly text: string }[]
}

/**
 * SSE バッチをマップへ取り込む純粋関数（自走展開・AC-3）。サーバー採番 id をそのまま使う。
 * - 起点バッチ（parentId=null）はマップを置き換える（origin=root）。
 * - 子バッチは未知 id のみ追加し、親→子エッジを張る（origin=auto）。id 重複は無視（冪等）。
 *   親はサーバーが必ず先に送る前提（BFS は depth 昇順）なので孤立エッジは生じない。
 */
export const applyBatch = (data: MapData, batch: ExpansionBatch): MapData => {
  if (batch.parentId === null) {
    const nodes: MindMapNode[] = batch.nodes.map((n) => ({
      id: n.id,
      text: n.text,
      depth: batch.depth,
      origin: 'root',
    }))
    return { nodes, edges: [], seq: data.seq }
  }

  const parentId = batch.parentId
  const existingIds = new Set(data.nodes.map((n) => n.id))
  const nodes: MindMapNode[] = [...data.nodes]
  const edges: MindMapEdge[] = [...data.edges]

  for (const n of batch.nodes) {
    if (existingIds.has(n.id)) {
      continue
    }
    existingIds.add(n.id)
    nodes.push({ id: n.id, text: n.text, depth: batch.depth, origin: 'auto' })
    edges.push({ id: `${parentId}->${n.id}`, source: parentId, target: n.id })
  }

  return { nodes, edges, seq: data.seq }
}

/** 既存 id と衝突しない新しいノード id を採番する（SSE 由来 id との混在でも安全）。 */
const nextFreshId = (existing: ReadonlySet<string>, seq: number): { id: string; seq: number } => {
  let s = seq
  let id = `n${s + 1}`
  while (existing.has(id)) {
    s += 1
    id = `n${s + 1}`
  }
  return { id, seq: s + 1 }
}

/**
 * 親ノードに手動ノードを1つ追加する純粋関数（FR-15）。origin='manual'。
 * - 親が無ければ throw（孤立エッジを作らない）。空テキストは throw。
 * - 既存と同テキストでも手動追加は許容する（ユーザーの明示操作を尊重）。
 */
export const addChildNode = (data: MapData, parentId: string, rawText: string): MapData => {
  const parent = data.nodes.find((n) => n.id === parentId)
  if (!parent) {
    throw new Error(`親ノードが見つかりません: ${parentId}`)
  }
  const text = rawText.trim()
  if (!text) {
    throw new Error('ノードのテキストが空です')
  }

  const existing = new Set(data.nodes.map((n) => n.id))
  const { id, seq } = nextFreshId(existing, data.seq)
  const nodes: MindMapNode[] = [
    ...data.nodes,
    { id, text, depth: parent.depth + 1, origin: 'manual' },
  ]
  const edges: MindMapEdge[] = [
    ...data.edges,
    { id: `${parentId}->${id}`, source: parentId, target: id },
  ]
  return { nodes, edges, seq }
}

/** ノードのテキストを編集する純粋関数（FR-16）。空テキストは throw。未知ノードは throw。 */
export const editNodeText = (data: MapData, nodeId: string, rawText: string): MapData => {
  const text = rawText.trim()
  if (!text) {
    throw new Error('ノードのテキストが空です')
  }
  if (!data.nodes.some((n) => n.id === nodeId)) {
    throw new Error(`ノードが見つかりません: ${nodeId}`)
  }
  const nodes = data.nodes.map((n) => (n.id === nodeId ? { ...n, text } : n))
  return { nodes, edges: data.edges, seq: data.seq }
}

/**
 * ノードを削除する純粋関数（FR-17 / AC-7）。対象ノードとその子孫をまとめて削除し、
 * 削除されたノードに接続する全エッジを除去する＝**孤立エッジも孤立ノードも残さない**。
 */
export const removeNodeCascade = (data: MapData, nodeId: string): MapData => {
  if (!data.nodes.some((n) => n.id === nodeId)) {
    return data
  }

  // 親→子の隣接を作り、対象から到達できる子孫を BFS で集める。
  const childrenOf = new Map<string, string[]>()
  for (const edge of data.edges) {
    const list = childrenOf.get(edge.source) ?? []
    list.push(edge.target)
    childrenOf.set(edge.source, list)
  }

  const removeSet = new Set<string>([nodeId])
  const queue = [nodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const child of childrenOf.get(current) ?? []) {
      if (!removeSet.has(child)) {
        removeSet.add(child)
        queue.push(child)
      }
    }
  }

  const nodes = data.nodes.filter((n) => !removeSet.has(n.id))
  // 削除ノードを source/target いずれかに持つエッジを除去（孤立エッジ禁止）。
  const edges = data.edges.filter((e) => !removeSet.has(e.source) && !removeSet.has(e.target))
  return { nodes, edges, seq: data.seq }
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
  /** 直近の自走展開の停止理由（未停止/未実行は null）。 */
  readonly stopReason: ExpansionStopReason | null
  /** 編集対象として選択中のノード id（未選択は null）。 */
  readonly selectedNodeId: string | null
  /** マップのタイトル（保存・一覧表示用）。 */
  readonly title: string
  /** 保存済みマップの id（未保存/新規は null。保存時の上書き判定に使う）。 */
  readonly mapId: string | null

  /** 起点キーワードでマップを作り直す（既存マップは破棄）。 */
  startNewMap: (keyword: string) => void
  /** タイトルを設定する。 */
  setTitle: (title: string) => void
  /** 保存済みマップを読み込んで再編集状態にする（id を保持し以後は上書き保存）。 */
  loadMap: (saved: SavedMap) => void
  /** 親ノードへ連想語を子として取り込む。 */
  appendChildren: (parentId: string, words: readonly AssociationWord[]) => void
  /** 自走展開の SSE バッチを取り込む（サーバー採番 id）。 */
  applyExpansionBatch: (batch: ExpansionBatch) => void
  /** 親ノードに手動ノードを追加する（FR-15）。 */
  addChildNode: (parentId: string, text: string) => void
  /** ノードのテキストを編集する（FR-16）。 */
  editNode: (nodeId: string, text: string) => void
  /** ノードを削除する（子孫・孤立エッジも除去・FR-17/AC-7）。 */
  removeNode: (nodeId: string) => void
  /** 編集対象ノードを選択する（null で選択解除）。 */
  selectNode: (nodeId: string | null) => void
  /** 展開モード（自動/手動）を切り替える。 */
  setMode: (mode: ExpansionMode) => void
  /** 生成設定を部分更新する。 */
  updateSettings: (patch: Partial<GenerationSettings>) => void
  /** 進行状態を設定する（生成中はエラーをクリア）。 */
  setStatus: (status: MapStatus) => void
  /** エラーメッセージを設定し status を 'error' にする。 */
  setError: (message: string) => void
  /** 停止理由を設定する。 */
  setStopReason: (reason: ExpansionStopReason | null) => void
  /** マップ（ノード/エッジ/進行状態）だけ初期化する。設定・モードは保持する。 */
  clearMap: () => void
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
  readonly stopReason: ExpansionStopReason | null
  readonly selectedNodeId: string | null
  readonly title: string
  readonly mapId: string | null
}

const initialFields = (): InitialFields => ({
  nodes: [],
  edges: [],
  seq: 0,
  settings: DEFAULT_GENERATION_SETTINGS,
  mode: 'auto',
  status: 'idle',
  errorMessage: null,
  stopReason: null,
  selectedNodeId: null,
  title: DEFAULT_TITLE,
  mapId: null,
})

/** マップ本体のみ初期化する差分（設定・モードは保持。新しいマップなので id/タイトルもリセット）。 */
const clearedMapFields = () => ({
  nodes: [],
  edges: [],
  seq: 0,
  status: 'idle' as const,
  errorMessage: null,
  stopReason: null,
  selectedNodeId: null,
  title: DEFAULT_TITLE,
  mapId: null,
})

export const useMindMapStore = create<MindMapStore>((set, get) => ({
  ...initialFields(),

  startNewMap: (keyword) => {
    const next = createRootMap(keyword)
    // 新規マップなので保存 id とタイトルもリセットする。
    set({
      nodes: next.nodes,
      edges: next.edges,
      seq: next.seq,
      status: 'idle',
      errorMessage: null,
      stopReason: null,
      selectedNodeId: null,
      title: DEFAULT_TITLE,
      mapId: null,
    })
  },

  setTitle: (title) => set({ title }),

  loadMap: (saved) =>
    set({
      nodes: saved.nodes,
      edges: saved.edges,
      seq: 0,
      settings: saved.settings,
      title: saved.title,
      mapId: saved.id,
      status: 'idle',
      errorMessage: null,
      stopReason: null,
      selectedNodeId: null,
    }),

  appendChildren: (parentId, words) => {
    const { nodes, edges, seq } = get()
    const next = appendAssociations({ nodes, edges, seq }, parentId, words)
    set({ nodes: next.nodes, edges: next.edges, seq: next.seq })
  },

  applyExpansionBatch: (batch) => {
    const { nodes, edges, seq } = get()
    const next = applyBatch({ nodes, edges, seq }, batch)
    set({ nodes: next.nodes, edges: next.edges, seq: next.seq })
  },

  addChildNode: (parentId, text) => {
    const { nodes, edges, seq } = get()
    const next = addChildNode({ nodes, edges, seq }, parentId, text)
    set({ nodes: next.nodes, edges: next.edges, seq: next.seq })
  },

  editNode: (nodeId, text) => {
    const { nodes, edges, seq } = get()
    const next = editNodeText({ nodes, edges, seq }, nodeId, text)
    set({ nodes: next.nodes, edges: next.edges, seq: next.seq })
  },

  removeNode: (nodeId) => {
    const { nodes, edges, seq } = get()
    const next = removeNodeCascade({ nodes, edges, seq }, nodeId)
    // 削除したノードを選択中なら選択解除する。
    const selectedNodeId = get().selectedNodeId
    const stillExists = next.nodes.some((n) => n.id === selectedNodeId)
    set({
      nodes: next.nodes,
      edges: next.edges,
      seq: next.seq,
      selectedNodeId: stillExists ? selectedNodeId : null,
    })
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  setMode: (mode) => set({ mode }),

  updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

  setStatus: (status) =>
    set({ status, errorMessage: status === 'error' ? get().errorMessage : null }),

  setError: (message) => set({ status: 'error', errorMessage: message }),

  setStopReason: (reason) => set({ stopReason: reason }),

  clearMap: () => set({ ...clearedMapFields() }),

  reset: () => set({ ...initialFields() }),
}))
