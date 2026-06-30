// 保存マップ一覧 UI（開く・削除・AC-10,11）。
// ログイン時のみ一覧を取得・表示する。他人のマップは API が返さない＝表示されない（AC-11）。

import { useCallback, useEffect, useState } from 'react'
import type { MapSummary } from '@rensoo/shared'
import { Button } from '../../ui/Button'
import { useAuth } from '../../auth/useAuth'
import { isAuthEnabled } from '../../auth/supabaseClient'
import { deleteMapById, fetchMapList, openMap } from './mapsFlow'

/** 一覧の再取得トリガ（保存後に key を変えると再取得する）。 */
export interface MapListPanelProps {
  readonly reloadKey?: number
}

export const MapListPanel = ({ reloadKey = 0 }: MapListPanelProps) => {
  const { user } = useAuth()
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

  // ログイン状態・保存トリガで再取得する。
  useEffect(() => {
    if (user) {
      void reload()
    } else {
      setMaps([])
    }
  }, [user, reloadKey, reload])

  if (!isAuthEnabled() || !user) {
    return null
  }

  const open = async (id: string): Promise<void> => {
    await openMap(id)
  }

  const remove = async (id: string): Promise<void> => {
    if (await deleteMapById(id)) {
      await reload()
    }
  }

  return (
    <div className="map-list">
      <div className="map-list__header">保存したマップ</div>
      {error && <div className="map-list__error">{error}</div>}
      {maps.length === 0 ? (
        <div className="map-list__empty">保存済みのマップはありません。</div>
      ) : (
        <ul className="map-list__items">
          {maps.map((m) => (
            <li key={m.id} className="map-list__item">
              <button type="button" className="map-list__open" onClick={() => void open(m.id)}>
                {m.title}
              </button>
              <Button type="button" variant="secondary" onClick={() => void remove(m.id)}>
                削除
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
