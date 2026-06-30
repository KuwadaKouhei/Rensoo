// マップ編集ツールバー（キーワード入力＋「作成」・DESIGN §2.1）。
// 生成中はローディング表示、失敗時は日本語エラー＋再試行（AC-1,12）。
// ドメイン操作はストア／生成フローへ委譲し、UI 自身はロジックを持たない（PLAN_PHILOSOPHY）。

import { useState, type FormEvent } from 'react'
import { Button } from '../../ui/Button'
import { useMindMapStore } from '../../store/mindMapStore'
import { createAssociationMap } from './createAssociationMap'

export const MindMapToolbar = () => {
  const [keyword, setKeyword] = useState('')
  const status = useMindMapStore((s) => s.status)
  const errorMessage = useMindMapStore((s) => s.errorMessage)

  const isGenerating = status === 'generating'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (isGenerating) return
    // 生成フローが状態（生成中/エラー）を管理するため、ここでは結果を待たずに委譲する。
    void createAssociationMap(keyword)
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
          {isGenerating ? '生成中…' : '作成'}
        </Button>
      </form>

      {status === 'error' && errorMessage && (
        <div role="alert" className="mindmap-toolbar__error">
          <span>{errorMessage}</span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void createAssociationMap(keyword)}
          >
            再試行
          </Button>
        </div>
      )}
    </div>
  )
}
