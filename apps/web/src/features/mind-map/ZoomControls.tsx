// ズームコントロール（M6・T22・MindWeave デザイン準拠）。右下に + / % / − / 全体表示 を並べる。
// React Flow の内側で使う（useReactFlow / useStore が要）。

import { useReactFlow, useStore } from '@xyflow/react'

const btnClass =
  'flex items-center justify-center rounded-[9px] bg-mm-kid-bg text-foreground transition-colors hover:bg-mm-node-bg'

export const ZoomControls = () => {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  // 現在ズーム倍率（transform=[x,y,zoom]）。表示用にパーセント化する。
  const zoom = useStore((s) => s.transform[2])

  return (
    <div className="absolute bottom-[22px] right-[22px] z-[15] flex flex-col gap-1.5 rounded-[13px] border border-border bg-card p-1.5 shadow-md">
      <button
        type="button"
        onClick={() => void zoomIn()}
        aria-label="拡大"
        className={`${btnClass} size-[38px] text-xl`}
      >
        +
      </button>
      <div className="text-center font-display text-[11px] font-semibold text-muted-foreground">
        {Math.round(zoom * 100)}%
      </div>
      <button
        type="button"
        onClick={() => void zoomOut()}
        aria-label="縮小"
        className={`${btnClass} size-[38px] text-2xl`}
      >
        −
      </button>
      <button
        type="button"
        onClick={() => void fitView({ duration: 400, padding: 0.2 })}
        aria-label="全体表示"
        title="全体表示"
        className="flex h-[30px] w-[38px] items-center justify-center rounded-[9px] bg-transparent text-[15px] text-muted-foreground transition-colors hover:bg-mm-kid-bg"
      >
        ⤢
      </button>
    </div>
  )
}
