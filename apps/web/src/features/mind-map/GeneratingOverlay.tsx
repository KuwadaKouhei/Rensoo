// 生成中の全画面ローディング（M6・T21・DESIGN §6.2/§6.5）。
// 背景の生成中マップを半透明オーバーレイでうっすら残しつつ、スピナーと進捗文言を中央に表示する。

import { useMindMapStore } from '../../store/mindMapStore'
import { shouldShowLoadingOverlay } from './generatingUi'

export const GeneratingOverlay = () => {
  const status = useMindMapStore((s) => s.status)
  const nodeCount = useMindMapStore((s) => s.nodes.length)
  const center = useMindMapStore((s) => s.nodes.find((n) => n.depth === 0)?.text ?? '')

  if (!shouldShowLoadingOverlay(status, nodeCount)) {
    return null
  }

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      style={{
        background: 'var(--mm-overlay)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className="size-14 rounded-full border-[3px] border-border"
        style={{ borderTopColor: 'var(--mm-accent)', animation: 'mmspin .9s linear infinite' }}
      />
      <div className="mt-6 text-lg font-bold text-foreground">AIが連想を広げています</div>
      {center && (
        <div className="mt-2 text-[13.5px] text-muted-foreground">
          「{center}」から関連する言葉を生成中…
        </div>
      )}
    </div>
  )
}
