import { beforeEach, describe, expect, it } from 'vitest'
import type { ExpansionRequest } from '@rensoo/shared'
import { ApiError } from '../../api-client/errors'
import type { ExpansionStreamHandlers } from '../../api-client/expansion'
import { useMindMapStore } from '../../store/mindMapStore'
import { startExpansion } from './runExpansionFlow'

// 自走展開フローの統合テスト。ストアは実物、SSE クライアントのみスタブ（TEST_PHILOSOPHY）。
beforeEach(() => {
  useMindMapStore.getState().reset()
})

/** ハンドラへ一連のイベントを同期的に流すスタブ streamExpansion を作る。 */
const driver =
  (drive: (h: ExpansionStreamHandlers, req: ExpansionRequest) => void) =>
  async (req: ExpansionRequest, handlers: ExpansionStreamHandlers): Promise<void> => {
    drive(handlers, req)
  }

describe('startExpansion', () => {
  it('SSE バッチを取り込み起点→子が描画され、停止理由と idle が確定する（AC-3）', async () => {
    await startExpansion('宇宙', {
      streamExpansion: driver((h) => {
        h.onNodeBatch?.({ parentId: null, depth: 0, nodes: [{ id: 'n1', text: '宇宙' }] })
        h.onNodeBatch?.({
          parentId: 'n1',
          depth: 1,
          nodes: [
            { id: 'n2', text: '銀河' },
            { id: 'n3', text: '惑星' },
          ],
        })
        h.onStopped?.({ reason: 'max_depth', totalNodes: 3 })
      }),
    })

    const s = useMindMapStore.getState()
    expect(s.nodes.map((n) => n.text)).toEqual(['宇宙', '銀河', '惑星'])
    expect(s.edges).toHaveLength(2)
    expect(s.status).toBe('idle')
    expect(s.stopReason).toBe('max_depth')
  })

  it('現在の設定が SSE リクエストに渡る（AC-2）', async () => {
    useMindMapStore.getState().updateSettings({ countPerNode: 4, maxDepth: 2 })
    let captured: ExpansionRequest | undefined
    await startExpansion('宇宙', {
      streamExpansion: async (req, h) => {
        captured = req
        h.onStopped?.({ reason: 'completed', totalNodes: 1 })
      },
    })
    expect(captured?.rootInput).toBe('宇宙')
    expect(captured?.settings.countPerNode).toBe(4)
    expect(captured?.settings.maxDepth).toBe(2)
  })

  it('error イベントは日本語メッセージで status=error（stopped で上書きしない・AC-12）', async () => {
    await startExpansion('宇宙', {
      streamExpansion: driver((h) => {
        h.onNodeBatch?.({ parentId: null, depth: 0, nodes: [{ id: 'n1', text: '宇宙' }] })
        h.onError?.({
          code: 'RATE_LIMITED',
          message: 'リクエストが集中しています。しばらくして再試行してください。',
          retryable: true,
        })
        // サーバーは error の後に stopped(user_stop) も送るが、error 表示を維持する。
        h.onStopped?.({ reason: 'user_stop', totalNodes: 1 })
      }),
    })

    const s = useMindMapStore.getState()
    expect(s.status).toBe('error')
    expect(s.errorMessage).toBe('リクエストが集中しています。しばらくして再試行してください。')
  })

  it('停止（stopped 未受信で正常終了）は user_stop として確定する（AC-6）', async () => {
    await startExpansion('宇宙', {
      streamExpansion: driver((h) => {
        h.onNodeBatch?.({ parentId: null, depth: 0, nodes: [{ id: 'n1', text: '宇宙' }] })
        // 接続クローズを模し stopped を送らずに正常 return する。
      }),
    })
    const s = useMindMapStore.getState()
    expect(s.status).toBe('idle')
    expect(s.stopReason).toBe('user_stop')
  })

  it('409 などの ApiError は日本語メッセージで status=error', async () => {
    await startExpansion('宇宙', {
      streamExpansion: async () => {
        throw new ApiError(
          'このキーワードの展開は実行中です。完了後に再試行してください。',
          'CONFLICT',
          true,
          409,
        )
      },
    })
    const s = useMindMapStore.getState()
    expect(s.status).toBe('error')
    expect(s.errorMessage).toContain('実行中です')
  })

  it('空キーワードは展開せずエラー表示する', async () => {
    let called = false
    await startExpansion('   ', {
      streamExpansion: async () => {
        called = true
      },
    })
    expect(called).toBe(false)
    expect(useMindMapStore.getState().status).toBe('error')
    expect(useMindMapStore.getState().nodes).toEqual([])
  })
})
