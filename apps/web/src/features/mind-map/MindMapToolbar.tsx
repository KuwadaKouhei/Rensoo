// マップ編集ツールバー（キーワード入力＋「作成」＋自動/手動トグル・DESIGN §2.1/§6.2）。
// 自動モード: 「作成」で自走展開（SSE・連鎖）。手動モード: 「作成」で起点＋1段の単発生成し、
// 以降はノードクリックで1段ずつ手動展開（連鎖しない・AC-4,5）。
// 生成中はローディング＋（自動時のみ）停止、停止後は停止理由、失敗時は日本語エラー＋再試行。

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../ui/Button'
import { useMindMapStore } from '../../store/mindMapStore'
import { useExpansionStream } from './useExpansionStream'
import { STOP_REASON_MESSAGE } from './runExpansionFlow'
import { createAssociationMap } from './createAssociationMap'

export interface MindMapToolbarProps {
  /** ホーム画面から遷移してきた際に、この語で生成を自動開始する（一度だけ・M6/T18）。 */
  readonly autoStartKeyword?: string
}

export const MindMapToolbar = ({ autoStartKeyword }: MindMapToolbarProps = {}) => {
  const [keyword, setKeyword] = useState(autoStartKeyword ?? '')
  const status = useMindMapStore((s) => s.status)
  const mode = useMindMapStore((s) => s.mode)
  const errorMessage = useMindMapStore((s) => s.errorMessage)
  const errorRetryable = useMindMapStore((s) => s.errorRetryable)
  const stopReason = useMindMapStore((s) => s.stopReason)
  const setMode = useMindMapStore((s) => s.setMode)
  const { start, stop } = useExpansionStream()

  const isGenerating = status === 'generating'

  const create = (value: string = keyword): void => {
    if (mode === 'auto') {
      start(value) // 自走展開（SSE・連鎖）
    } else {
      void createAssociationMap(value) // 単発（起点＋1段、連鎖しない）
    }
  }

  // ホームから渡された起点キーワードで、初回マウント時に一度だけ生成を開始する（M6/T18）。
  const autoStarted = useRef(false)
  useEffect(() => {
    const kw = autoStartKeyword?.trim()
    if (kw && !autoStarted.current) {
      autoStarted.current = true
      create(kw)
    }
    // 初回マウント時のみ実行（autoStarted ガード）。create は最新 mode を参照する。
  }, [autoStartKeyword])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (isGenerating) return
    create()
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
          <Button type="button" variant="secondary" onClick={stop}>
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
            <Button type="button" variant="secondary" onClick={() => create()}>
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
