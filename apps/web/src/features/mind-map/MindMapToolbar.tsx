// マップ編集ツールバー（キーワード入力＋「作成」＋自動/手動トグル・DESIGN §2.1/§6.2）。
// 生成の実行/停止は親（EditorPage）が単一の展開コントローラで所有し、onCreate/onStop で受け取る
//（トップバーの「再生成」と本ツールバーの「停止」が同じストリームに作用するようにするため）。
// 生成中はローディング＋（自動時のみ）停止、停止後は停止理由、失敗時は日本語エラー＋再試行。

import { useState, type FormEvent } from 'react'
import { Button } from '../../ui/Button'
import { useMindMapStore } from '../../store/mindMapStore'
import { STOP_REASON_MESSAGE } from './runExpansionFlow'

export interface MindMapToolbarProps {
  /** 起点キーワードで生成を開始する（自動=SSE / 手動=単発。分岐は親が担う）。 */
  readonly onCreate: (keyword: string) => void
  /** 実行中の自走展開を停止する。 */
  readonly onStop: () => void
}

export const MindMapToolbar = ({ onCreate, onStop }: MindMapToolbarProps) => {
  const [keyword, setKeyword] = useState('')
  const status = useMindMapStore((s) => s.status)
  const mode = useMindMapStore((s) => s.mode)
  const errorMessage = useMindMapStore((s) => s.errorMessage)
  const errorRetryable = useMindMapStore((s) => s.errorRetryable)
  const stopReason = useMindMapStore((s) => s.stopReason)
  const setMode = useMindMapStore((s) => s.setMode)

  const isGenerating = status === 'generating'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (isGenerating) return
    onCreate(keyword)
  }

  return (
    <div className="mindmap-toolbar">
      <form onSubmit={submit} className="mindmap-toolbar__form">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="キーワードを入力（例: 宇宙）"
          aria-label="連想の起点キーワード"
          disabled={isGenerating}
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

      <fieldset className="mindmap-toolbar__mode" disabled={isGenerating}>
        <legend>展開モード</legend>
        <label>
          <input
            type="radio"
            name="expansion-mode"
            value="auto"
            checked={mode === 'auto'}
            onChange={() => setMode('auto')}
          />
          自動（連鎖して広げる）
        </label>
        <label>
          <input
            type="radio"
            name="expansion-mode"
            value="manual"
            checked={mode === 'manual'}
            onChange={() => setMode('manual')}
          />
          手動（ノードをクリックして1段ずつ）
        </label>
      </fieldset>

      {status === 'error' && errorMessage && (
        <div role="alert" className="mindmap-toolbar__error">
          <span>{errorMessage}</span>
          {errorRetryable && (
            <Button type="button" variant="secondary" onClick={() => onCreate(keyword)}>
              再試行
            </Button>
          )}
        </div>
      )}

      {status !== 'error' && status !== 'generating' && stopReason && (
        <div className="mindmap-toolbar__notice">{STOP_REASON_MESSAGE[stopReason]}</div>
      )}

      {mode === 'manual' && status !== 'error' && (
        <div className="mindmap-toolbar__notice">
          ノードをクリックすると、その語からさらに連想を広げます。
        </div>
      )}
    </div>
  )
}
