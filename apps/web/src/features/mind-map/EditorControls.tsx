// 編集画面の生成コントロール（左上・M6 レイアウト再構成）。
// キーワード入力＋作成／停止・再生成、展開モード、連想件数、生成状態（追加中・エラー/再試行・停止理由・手動ヒント）をまとめる。
// 生成の実行/停止は親（EditorPage）が単一の展開コントローラで所有し、onCreate/onStop で受け取る。

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { useMindMapStore } from '../../store/mindMapStore'
import { GenerationSettingsPanel } from '../generation-settings/GenerationSettingsPanel'
import { STOP_REASON_MESSAGE } from './runExpansionFlow'
import { shouldShowBuildingIndicator } from './generatingUi'

export interface EditorControlsProps {
  /** 起点キーワードで生成を開始する（自動=SSE / 手動=単発。分岐は親が担う）。 */
  readonly onCreate: (keyword: string) => void
  /** 実行中の自走展開を停止する。 */
  readonly onStop: () => void
}

const MODES = [
  { value: 'auto', label: '自動' },
  { value: 'manual', label: '手動' },
] as const

export const EditorControls = ({ onCreate, onStop }: EditorControlsProps) => {
  const [keyword, setKeyword] = useState('')
  const status = useMindMapStore((s) => s.status)
  const mode = useMindMapStore((s) => s.mode)
  const setMode = useMindMapStore((s) => s.setMode)
  const errorMessage = useMindMapStore((s) => s.errorMessage)
  const errorRetryable = useMindMapStore((s) => s.errorRetryable)
  const stopReason = useMindMapStore((s) => s.stopReason)
  const nodeCount = useMindMapStore((s) => s.nodes.length)
  const center = useMindMapStore((s) => s.nodes.find((n) => n.depth === 0)?.text ?? '')

  // キーワード入力の初期値に、ホームで生成した起点キーワード（＝中心ノードの語）を一度だけ入れる。
  // 以後の手入力は尊重する（上書きしない）。
  const seeded = useRef(false)
  useEffect(() => {
    if (!seeded.current && center) {
      setKeyword(center)
      seeded.current = true
    }
  }, [center])

  const isGenerating = status === 'generating'

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (isGenerating) return
    onCreate(keyword)
  }

  return (
    <div className="flex w-[min(86vw,320px)] flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 text-card-foreground shadow-lg backdrop-blur">
      {/* キーワード → 作成 / 停止 */}
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="キーワードを入力（例: 宇宙）"
          aria-label="連想の起点キーワード"
          disabled={isGenerating}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <Button type="submit" disabled={isGenerating}>
          {isGenerating ? '展開中…' : '作成'}
        </Button>
        {isGenerating && mode === 'auto' && (
          <Button type="button" variant="secondary" onClick={onStop}>
            停止
          </Button>
        )}
      </form>

      {/* 展開モード */}
      <div>
        <div className="mb-1.5 text-xs font-semibold text-muted-foreground">展開モード</div>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={isGenerating}
              onClick={() => setMode(m.value)}
              className={`rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-50 ${
                mode === m.value
                  ? 'bg-mm-accent/15 text-mm-accent'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 連想件数（1ノードあたり・3〜10） */}
      <GenerationSettingsPanel />

      {/* 再生成（起点キーワードで再実行） */}
      {center && !isGenerating && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => onCreate(center)}
        >
          ↻「{center}」を再生成
        </Button>
      )}

      {/* 生成状態 */}
      {shouldShowBuildingIndicator(status, nodeCount) && (
        <div className="text-[13px] font-semibold text-mm-accent">AIが連想を追加中…</div>
      )}
      {status === 'error' && errorMessage && (
        <div role="alert" className="flex items-center gap-2 text-[13px] text-destructive">
          <span className="flex-1">{errorMessage}</span>
          {errorRetryable && (
            <Button type="button" variant="secondary" size="sm" onClick={() => onCreate(keyword)}>
              再試行
            </Button>
          )}
        </div>
      )}
      {status !== 'error' && status !== 'generating' && stopReason && (
        <div className="text-[12.5px] text-muted-foreground">{STOP_REASON_MESSAGE[stopReason]}</div>
      )}
      {mode === 'manual' && status !== 'error' && (
        <div className="text-[12.5px] text-muted-foreground">
          ノードをクリックすると、その語からさらに連想を広げます。
        </div>
      )}
    </div>
  )
}
