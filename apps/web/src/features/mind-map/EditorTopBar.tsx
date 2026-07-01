// 編集画面のトップバー（M6・レイアウト再構成）。
// 中央に起点キーワードの「〜の連想マップ」ラベルのみを表示する。
// 生成コントロール（作成/停止/再生成・モード・件数）は左上の EditorControls、アカウントは右上へ分離した。

import { useMindMapStore } from '../../store/mindMapStore'

export const EditorTopBar = () => {
  const center = useMindMapStore((s) => s.nodes.find((n) => n.depth === 0)?.text ?? '')

  // 起点がまだ無い（マップ未生成）ときはトップバーを出さない。
  if (!center) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[15] flex items-center justify-center p-4">
      <div className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2 shadow-md">
        <span
          className="size-2 rounded-full"
          style={{ background: 'linear-gradient(135deg, var(--mm-root-a), var(--mm-root-b))' }}
        />
        <span className="text-[14.5px] font-bold text-foreground">{center}</span>
        <span className="text-[12.5px] text-muted-foreground">の連想マップ</span>
      </div>
    </div>
  )
}
