// 自走展開 SSE 受信（DESIGN §6.2/§6.5・AC-3,6）。
// SSE は POST + リクエストボディが必要なため EventSource は使えず、fetch のストリームを手動パースする。
// 各イベントのデータは shared の Zod スキーマで検証してから型付き値としてハンドラへ渡す
//（CODING_PHILOSOPHY「外部入出力はスキーマ検証」）。停止は AbortSignal（接続クローズ）で行う（AC-6）。

import {
  EXPANSION_EVENT,
  expansionErrorSchema,
  expansionNodeBatchSchema,
  expansionProgressSchema,
  expansionStoppedSchema,
  type ExpansionError,
  type ExpansionNodeBatch,
  type ExpansionProgress,
  type ExpansionRequest,
  type ExpansionStopped,
} from '@rensoo/shared'
import { errorFromResponse, invalidResponseError, networkError } from './errors'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

/** SSE イベントごとのハンドラ（必要なものだけ実装すればよい）。 */
export interface ExpansionStreamHandlers {
  readonly onNodeBatch?: (batch: ExpansionNodeBatch) => void
  readonly onProgress?: (progress: ExpansionProgress) => void
  readonly onStopped?: (stopped: ExpansionStopped) => void
  readonly onError?: (error: ExpansionError) => void
}

/** 1つの SSE フレーム（"event:" と "data:" 行の集合）をパースする。 */
const parseFrame = (frame: string): { event: string; data: string } | null => {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim())
    }
  }
  if (dataLines.length === 0) {
    return null
  }
  return { event, data: dataLines.join('\n') }
}

/** フレームを Zod 検証して対応ハンドラへディスパッチする。検証失敗は握りつぶさず error ハンドラへ。 */
const dispatch = (
  frame: { event: string; data: string },
  handlers: ExpansionStreamHandlers,
): void => {
  let json: unknown
  try {
    json = JSON.parse(frame.data)
  } catch {
    handlers.onError?.({
      code: 'INVALID_RESPONSE',
      message: 'サーバーの応答を解釈できませんでした。',
      retryable: true,
    })
    return
  }

  switch (frame.event) {
    case EXPANSION_EVENT.nodeBatch: {
      const parsed = expansionNodeBatchSchema.safeParse(json)
      if (parsed.success) handlers.onNodeBatch?.(parsed.data)
      break
    }
    case EXPANSION_EVENT.progress: {
      const parsed = expansionProgressSchema.safeParse(json)
      if (parsed.success) handlers.onProgress?.(parsed.data)
      break
    }
    case EXPANSION_EVENT.stopped: {
      const parsed = expansionStoppedSchema.safeParse(json)
      if (parsed.success) handlers.onStopped?.(parsed.data)
      break
    }
    case EXPANSION_EVENT.error: {
      const parsed = expansionErrorSchema.safeParse(json)
      if (parsed.success) handlers.onError?.(parsed.data)
      break
    }
    default:
      // 未知イベントは無視（前方互換）。
      break
  }
}

/**
 * 自走展開を開始し、SSE を受信してハンドラへ流す。
 * - 非 2xx（400/409 等）は ApiError として throw（呼び出し側で日本語表示）。
 * - signal.abort() で接続を閉じると、サーバー側 BFS も停止する（AC-6）。中断は正常終了として扱う。
 */
export const streamExpansion = async (
  req: ExpansionRequest,
  handlers: ExpansionStreamHandlers,
  signal?: AbortSignal,
): Promise<void> => {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/api/expansion/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) return // ユーザー停止は正常終了。
    throw networkError(err)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => undefined)
    throw errorFromResponse(res.status, body)
  }
  if (!res.body) {
    throw invalidResponseError(new Error('SSE 応答にボディがありません'))
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // フレーム区切りは空行（\n\n）。CRLF も許容する。
      let sep: number
      while ((sep = findSeparator(buffer)) !== -1) {
        const rawFrame = buffer.slice(0, sep)
        buffer = buffer.slice(sep).replace(/^(\r?\n){2}/, '')
        const frame = parseFrame(rawFrame)
        if (frame) dispatch(frame, handlers)
      }
    }
  } catch (err) {
    if (signal?.aborted) return // 停止操作による中断は正常終了。
    throw err
  }
}

/** バッファ内の最初のフレーム区切り（\n\n または \r\n\r\n）位置を返す。なければ -1。 */
const findSeparator = (buffer: string): number => {
  const lf = buffer.indexOf('\n\n')
  const crlf = buffer.indexOf('\r\n\r\n')
  if (lf === -1) return crlf
  if (crlf === -1) return lf
  return Math.min(lf, crlf)
}
