import type { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { EXPANSION_EVENT, expansionRequestSchema, type AssociationProvider } from '@rensoo/shared'
import type { ErrorResponseBody } from '../errors.js'
import { runExpansion, type ExpansionEvent } from '../../app/expansion/expansionOrchestrator.js'
import type { InMemoryExpansionLock } from '../../app/expansion/expansionLock.js'

/** 内部イベント type → SSE イベント名の対応。 */
const EVENT_NAME: Record<ExpansionEvent['type'], string> = {
  'node-batch': EXPANSION_EVENT.nodeBatch,
  progress: EXPANSION_EVENT.progress,
  stopped: EXPANSION_EVENT.stopped,
  error: EXPANSION_EVENT.error,
}

/** SSE で送るデータ（type は SSE event 名に移すので除く）。 */
const toPayload = (event: ExpansionEvent): Record<string, unknown> => {
  const rest: Record<string, unknown> = { ...event }
  delete rest.type
  return rest
}

/**
 * POST /api/expansion/stream（自走展開・SSE・認証任意・AC-3,6）。
 * 入力を Zod 検証 → マップ単位ロック取得（多重実行は 409）→ SSE で BFS を段階送信。
 * 接続クローズ（onAbort）で中断フラグを立て、追加の LLM 呼び出しを止める（AC-6）。
 */
export const registerExpansionRoutes = (
  app: Hono,
  provider: AssociationProvider,
  lock: InMemoryExpansionLock,
): void => {
  app.post(
    '/api/expansion/stream',
    zValidator('json', expansionRequestSchema, (result, c) => {
      if (!result.success) {
        const body: ErrorResponseBody = {
          error: {
            code: 'VALIDATION',
            message: '入力が正しくありません。キーワードと設定を確認してください。',
            retryable: false,
          },
        }
        return c.json(body, 400)
      }
      return undefined
    }),
    (c) => {
      const { rootInput, settings } = c.req.valid('json')
      const key = rootInput.trim()

      // 多重実行抑制: 実行中の同一マップ（MVP はキーワード）には 409 を返す（NFR-4）。
      if (!lock.tryAcquire(key)) {
        const body: ErrorResponseBody = {
          error: {
            code: 'CONFLICT',
            message: 'このキーワードの展開は実行中です。完了後に再試行してください。',
            retryable: true,
          },
        }
        return c.json(body, 409)
      }

      return streamSSE(c, async (stream) => {
        const signal = { aborted: false }
        // 接続クローズ（停止操作）で中断フラグを立てる。サーバー側 BFS は次ステップで離脱する。
        stream.onAbort(() => {
          signal.aborted = true
        })

        try {
          await runExpansion(rootInput, settings, {
            provider,
            signal,
            emit: async (event) => {
              await stream.writeSSE({
                event: EVENT_NAME[event.type],
                data: JSON.stringify(toPayload(event)),
              })
            },
          })
        } catch (err) {
          // 想定外（emit/stream 失敗など）は SSE error として通知し握りつぶさない。
          console.error('[expansion] 想定外のエラー', err)
          await stream.writeSSE({
            event: EXPANSION_EVENT.error,
            data: JSON.stringify({
              code: 'INTERNAL',
              message: '自走展開中にエラーが発生しました。',
              retryable: false,
            }),
          })
        } finally {
          lock.release(key)
        }
      })
    },
  )
}
