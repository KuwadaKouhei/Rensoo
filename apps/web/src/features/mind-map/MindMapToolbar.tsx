// マップ編集ツールバー（キーワード入力＋「作成」＝自走展開・DESIGN §2.1/§6.2）。
// 自動モードでの「作成」を expansion/stream（SSE）に接続し、段階的に描画する。
// 生成中はローディング＋停止ボタン、停止後は停止理由、失敗時は日本語エラー＋再試行（AC-3,6,12）。

import { useState, type FormEvent } from 'react'
import { Button } from '../../ui/Button'
import { useMindMapStore } from '../../store/mindMapStore'
import { useExpansionStream } from './useExpansionStream'
import { STOP_REASON_MESSAGE } from './runExpansionFlow'

export const MindMapToolbar = () => {
  const [keyword, setKeyword] = useState('')
  const status = useMindMapStore((s) => s.status)
  const errorMessage = useMindMapStore((s) => s.errorMessage)
  const stopReason = useMindMapStore((s) => s.stopReason)
  const { start, stop } = useExpansionStream()

  const isGenerating = status === 'generating'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (isGenerating) return
    start(keyword)
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
        {isGenerating && (
          <Button type="button" variant="secondary" onClick={stop}>
            停止
          </Button>
        )}
      </form>

      {status === 'error' && errorMessage && (
        <div role="alert" className="mindmap-toolbar__error">
          <span>{errorMessage}</span>
          <Button type="button" variant="secondary" onClick={() => start(keyword)}>
            再試行
          </Button>
        </div>
      )}

      {status !== 'error' && status !== 'generating' && stopReason && (
        <div className="mindmap-toolbar__notice">{STOP_REASON_MESSAGE[stopReason]}</div>
      )}
    </div>
  )
}
