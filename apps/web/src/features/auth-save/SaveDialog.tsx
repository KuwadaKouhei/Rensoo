// 保存 UI（タイトル入力＋保存・AC-9,10）。編集画面の右上（ログイン時のみ表示）。
// 呼び出し側（EditorPage）でログイン時のみ描画するが、認証無効環境では二重に null を返す（AC-8）。

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMindMapStore } from '../../store/mindMapStore'
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
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="タイトル"
          aria-label="マップのタイトル"
          className="w-44 rounded-md border border-input bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button type="button" onClick={() => void save()} disabled={saving || nodeCount === 0}>
          {saving ? '保存中…' : '保存'}
        </Button>
      </div>

      {loginRequired && (
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[12.5px] text-destructive shadow"
        >
          保存にはログインが必要です。
        </div>
      )}
      {message && (
        <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[12.5px] text-muted-foreground shadow">
          {message}
        </div>
      )}
    </div>
  )
}
