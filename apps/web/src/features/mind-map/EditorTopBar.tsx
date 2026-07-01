// 編集画面のトップバー（M6・T21・MindWeave デザイン準拠）。
// 左: 起点キーワードの「〜の連想マップ」ラベル。右: 生成中の追加中インジケータ＋「再生成」ボタン。

import { useMindMapStore } from '../../store/mindMapStore'
import { shouldShowBuildingIndicator } from './generatingUi'

export interface EditorTopBarProps {
  /** 起点キーワードで生成をやり直す。 */
  readonly onRegenerate: (keyword: string) => void
}

/** 「AIが連想を追加中」のドットアニメ。 */
const BuildingDots = () => (
  <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-mm-accent">
    <span className="inline-flex gap-[3px]">
      {[0, 0.2, 0.4].map((delay) => (
        <span
          key={delay}
          className="size-[5px] rounded-full bg-mm-accent"
          style={{ animation: `mmdots 1.2s ${delay}s infinite` }}
        />
      ))}
    </span>
    AIが連想を追加中
  </span>
)

export const EditorTopBar = ({ onRegenerate }: EditorTopBarProps) => {
  const status = useMindMapStore((s) => s.status)
  const nodeCount = useMindMapStore((s) => s.nodes.length)
  const center = useMindMapStore((s) => s.nodes.find((n) => n.depth === 0)?.text ?? '')

  // 起点がまだ無い（マップ未生成）ときはトップバーを出さない。
  if (!center) return null

  const isGenerating = status === 'generating'

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[15] flex items-center justify-end gap-3 p-4">
      <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2 shadow-md">
        <span
          className="size-2 rounded-full"
          style={{ background: 'linear-gradient(135deg, var(--mm-root-a), var(--mm-root-b))' }}
        />
        <span className="text-[14.5px] font-bold text-foreground">{center}</span>
        <span className="text-[12.5px] text-muted-foreground">の連想マップ</span>
      </div>

      <div className="pointer-events-auto flex items-center gap-3">
        {shouldShowBuildingIndicator(status, nodeCount) && <BuildingDots />}
        <button
          type="button"
          onClick={() => onRegenerate(center)}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 rounded-[11px] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-opacity disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, var(--mm-root-a), var(--mm-root-b))' }}
        >
          ↻ 再生成
        </button>
      </div>
    </div>
  )
}
