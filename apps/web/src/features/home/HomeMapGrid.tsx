// ログイン時のホーム: 保存マップ一覧グリッド（M6・T19・AC-10）。
// カードのクリックで開いて編集画面へ遷移、削除で一覧から消える。他人のマップは API が返さない（AC-11）。

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MapSummary } from '@rensoo/shared'
import { Trash2 } from 'lucide-react'
import { deleteMapById, fetchMapList, openMap } from '@/features/auth-save/mapsFlow'
import { formatUpdatedAt } from './formatUpdatedAt'

/** カードのミニプレビュー（中心＋放射状のダット・デザイン準拠の装飾）。 */
const MiniPreview = () => (
  <div className="relative mb-3 h-[92px] overflow-hidden rounded-[11px] border border-border bg-mm-bg2">
    <span
      className="absolute left-1/2 top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{ background: 'linear-gradient(135deg, var(--mm-root-a), var(--mm-root-b))' }}
    />
    {[0, 1, 2, 3, 4].map((i) => {
      const a = ((-90 + i * 72) * Math.PI) / 180
      return (
        <span
          key={i}
          className="absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-mm-node-border bg-mm-node-bg"
          style={{ left: `${50 + 30 * Math.cos(a)}%`, top: `${50 + 30 * Math.sin(a)}%` }}
        />
      )
    })}
  </div>
)

export interface HomeMapGridProps {
  /** 保存後などに一覧を再取得するトリガ。 */
  readonly reloadKey?: number
}

export const HomeMapGrid = ({ reloadKey = 0 }: HomeMapGridProps) => {
  const navigate = useNavigate()
  const [maps, setMaps] = useState<readonly MapSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    try {
      setMaps(await fetchMapList())
    } catch {
      setError('一覧の取得に失敗しました。')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, reloadKey])

  const open = async (id: string): Promise<void> => {
    if (await openMap(id)) {
      navigate('/map')
    }
  }

  const remove = async (id: string): Promise<void> => {
    if (await deleteMapById(id)) {
      await reload()
    }
  }

  const now = Date.now()

  return (
    <div className="mx-auto max-w-[960px] px-6 pb-20 pt-12 md:px-10">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-xl font-bold">保存したマインドマップ</h2>
        <span className="text-[13px] text-muted-foreground">{maps.length}件</span>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-[13px] text-destructive">
          {error}
        </div>
      )}

      {maps.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          保存済みのマインドマップはありません。キーワードを入力して最初のマップを作りましょう。
        </p>
      ) : (
        <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {maps.map((m) => (
            <div key={m.id} className="group relative rounded-2xl border border-border bg-card p-3.5">
              <button
                type="button"
                onClick={() => void open(m.id)}
                className="block w-full text-left"
                aria-label={`「${m.title}」を開く`}
              >
                <MiniPreview />
                <div className="truncate text-[14.5px] font-bold text-foreground">{m.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatUpdatedAt(m.updatedAt, now)}
                </div>
              </button>
              <button
                type="button"
                onClick={() => void remove(m.id)}
                aria-label={`「${m.title}」を削除`}
                title="削除"
                className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
