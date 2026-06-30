// マップ編集ツールバー（キーワード入力＋「作成」＋自動/手動トグル・DESIGN §2.1/§6.2）。
// 自動モード: 「作成」で自走展開（SSE・連鎖）。手動モード: 「作成」で起点＋1段の単発生成し、
// 以降はノードクリックで1段ずつ手動展開（連鎖しない・AC-4,5）。
// 生成中はローディング＋（自動時のみ）停止、停止後は停止理由、失敗時は日本語エラー＋再試行。

import { useState, type FormEvent } from 'react'
import { Button } from '../../ui/Button'
import { useMindMapStore } from '../../store/mindMapStore'
import { useExpansionStream } from './useExpansionStream'
import { STOP_REASON_MESSAGE } from './runExpansionFlow'
import { createAssociationMap } from './createAssociationMap'

export const MindMapToolbar = () => {
  const [keyword, setKeyword] = useState('')
  const status = useMindMapStore((s) => s.status)
  const mode = useMindMapStore((s) => s.mode)
  const errorMessage = useMindMapStore((s) => s.errorMessage)
  const stopReason = useMindMapStore((s) => s.stopReason)
  const setMode = useMindMapStore((s) => s.setMode)
  const { start, stop } = useExpansionStream()

  const isGenerating = status === 'generating'

  const create = (): void => {
    if (mode === 'auto') {
      start(keyword) // 自走展開（SSE・連鎖）
    } else {
      void createAssociationMap(keyword) // 単発（起点＋1段、連鎖しない）
    }
  }

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
          <Button type="button" variant="secondary" onClick={create}>
            再試行
          </Button>
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
