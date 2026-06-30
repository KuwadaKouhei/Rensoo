import type { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { EXPANSION_EVENT, expansionRequestSchema, type AssociationProvider } from '@rensoo/shared'
import { errorBody } from '../errorResponses.js'
import type { AuthEnv } from '../middleware/auth.js'
import { runExpansion, type ExpansionEvent } from '../../app/expansion/expansionOrchestrator.js'
import type { InMemoryExpansionLock } from '../../app/expansion/expansionLock.js'
import { logInfo } from '../../app/observability/logger.js'

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
  app: Hono<AuthEnv>,
  provider: AssociationProvider,
  lock: InMemoryExpansionLock,
): void => {
  app.post(
    '/api/expansion/stream',
    zValidator('json', expansionRequestSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          errorBody('VALIDATION', {
            message: '入力が正しくありません。キーワードと設定を確認してください。',
          }),
          400,
        )
      }
      return undefined
    }),
    (c) => {
      const { rootInput, settings } = c.req.valid('json')
      const key = rootInput.trim()

      // 多重実行抑制: 実行中の同一マップ（MVP はキーワード）には 409 を返す（NFR-4）。
      if (!lock.tryAcquire(key)) {
        return c.json(
          errorBody('CONFLICT', {
            message: 'このキーワードの展開は実行中です。完了後に再試行してください。',
          }),
          409,
        )
      }

      return streamSSE(c, async (stream) => {
        const signal = { aborted: false }
        // 接続クローズ（停止操作）で中断フラグを立てる。サーバー側 BFS は次ステップで離脱する。
        stream.onAbort(() => {
          signal.aborted = true
        })

        // 可観測性（DESIGN §8.4）: コール数・所要時間・停止理由を記録（機微情報＝キーワード本文は出さない）。
        const startedAt = Date.now()
        let llmBatches = 0
        let stoppedReason = 'unknown'
        let totalNodes = 0
        logInfo('expansion.start', {
          rootInputLength: key.length,
          countPerNode: settings.countPerNode,
          maxDepth: settings.maxDepth,
          maxNodes: settings.maxNodes,
        })

        try {
          await runExpansion(rootInput, settings, {
            provider,
            signal,
            emit: async (event) => {
              if (event.type === 'node-batch' && event.parentId !== null) llmBatches += 1
              if (event.type === 'progress') totalNodes = event.totalNodes
              if (event.type === 'stopped') stoppedReason = event.reason
              await stream.writeSSE({
                event: EVENT_NAME[event.type],
                data: JSON.stringify(toPayload(event)),
              })
            },
          })
          logInfo('expansion.finish', {
            reason: stoppedReason,
            totalNodes,
            llmBatches,
            durationMs: Date.now() - startedAt,
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
