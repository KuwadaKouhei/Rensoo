// 生成中 UI の表示条件（M6・T21）。副作用を持たない純粋関数に切り出し、状態分岐を決定的にテストする。
// - 生成中はノードのクリック（選択・編集・手動展開）を禁止する。
// - 生成直後（ノードがまだ揃わない）は全画面ローディング、ノードが増え始めたらトップバーの追加中インジケータへ。

import type { MapStatus } from '../../store/mindMapStore'

/** 生成中はキャンバス/ツリーの操作（選択・編集）をロックする。 */
export const isInteractionLocked = (status: MapStatus): boolean => status === 'generating'

/** 全画面ローディング表示の条件（生成中かつノードがまだ 1 個以下＝起点のみ/空）。 */
export const shouldShowLoadingOverlay = (status: MapStatus, nodeCount: number): boolean =>
  status === 'generating' && nodeCount < 2

/** トップバーの「AIが連想を追加中」インジケータの条件（生成中かつノードが増え始めた）。 */
export const shouldShowBuildingIndicator = (status: MapStatus, nodeCount: number): boolean =>
  status === 'generating' && nodeCount >= 2
