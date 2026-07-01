// 生成完了時の fitView トリガ判定（M6・T22）。副作用境界を薄く保つため純粋関数に切り出す。
// 「生成中（generating）→ 完了（idle）」に遷移した瞬間だけ true。段階描画中や error では発火しない。

import type { MapStatus } from '../../store/mindMapStore'

/**
 * status が生成中から完了へ変化したかを判定する。
 * - generating → idle: 完了（自走展開の停止=idle＋stopReason も idle 遷移に含む）。fit する。
 * - それ以外（generating 継続・error・idle 継続）は fit しない（毎バッチや失敗では整えない）。
 */
export const shouldFitViewOnStatusChange = (prev: MapStatus, next: MapStatus): boolean =>
  prev === 'generating' && next === 'idle'
