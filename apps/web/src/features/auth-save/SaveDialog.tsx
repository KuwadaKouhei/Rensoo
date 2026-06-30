// 保存 UI（タイトル入力＋保存・AC-9,10）。
// 未ログインで保存を押すとログイン要求を表示する（AC-9）。ログイン後に保存できる。

import { useState } from 'react'
import { Button } from '../../ui/Button'
import { useMindMapStore } from '../../store/mindMapStore'
import { useAuth } from '../../auth/useAuth'
import { isAuthEnabled } from '../../auth/supabaseClient'
import { saveCurrentMap } from './mapsFlow'

export interface SaveDialogProps {
  /** 保存成功時に呼ぶ（一覧の再取得などに使う）。 */
  readonly onSaved?: () => void
}

export const SaveDialog = ({ onSaved }: SaveDialogProps) => {
  const title = useMindMapStore((s) => s.title)
  const setTitle = useMindMapStore((s) => s.setTitle)
  const nodeCount = useMindMapStore((s) => s.nodes.length)
  const { user } = useAuth()

  const [loginRequired, setLoginRequired] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // 認証無効環境では保存 UI を出さない（ゲスト専用・AC-8）。
  if (!isAuthEnabled()) {
    return null
  }

  const save = async (): Promise<void> => {
    setMessage(null)
    setLoginRequired(false)
    setSaving(true)
    try {
      const result = await saveCurrentMap()
      if (result.ok) {
        setMessage('保存しました。')
        onSaved?.()
      } else if (result.reason === 'login-required') {
        setLoginRequired(true) // AC-9: 保存前にログイン要求
      } else {
        setMessage(result.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="save-dialog">
      <label className="save-dialog__field">
        <span>タイトル</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          aria-label="マップのタイトル"
        />
      </label>
      <Button type="button" onClick={() => void save()} disabled={saving || nodeCount === 0}>
        {saving ? '保存中…' : '保存'}
      </Button>

      {loginRequired && (
        <div role="alert" className="save-dialog__notice">
          保存にはログインが必要です。
          {user ? '' : '上の「Google でログイン」からログインしてください。'}
        </div>
      )}
      {message && <div className="save-dialog__notice">{message}</div>}
    </div>
  )
}
