import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExpansionError, ExpansionNodeBatch, ExpansionStopped } from '@rensoo/shared'
import { streamExpansion } from './expansion'
import { ApiError } from './errors'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** SSE テキストを本文に持つ 200 応答を返す fetch スタブ。 */
const stubSSE = (sse: string): void => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(sse))
      controller.close()
    },
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    ),
  )
}

const req = { rootInput: '宇宙', settings: { countPerNode: 6, maxDepth: 3, maxNodes: 50 } } as const

describe('streamExpansion', () => {
  it('SSE フレームを Zod 検証して各ハンドラへ振り分ける', async () => {
    const sse =
      'event: node-batch\ndata: {"parentId":null,"depth":0,"nodes":[{"id":"n1","text":"宇宙"}]}\n\n' +
      'event: progress\ndata: {"totalNodes":1,"depth":0}\n\n' +
      'event: node-batch\ndata: {"parentId":"n1","depth":1,"nodes":[{"id":"n2","text":"銀河"}]}\n\n' +
      'event: stopped\ndata: {"reason":"max_depth","totalNodes":2}\n\n'
    stubSSE(sse)

    const batches: ExpansionNodeBatch[] = []
    let stopped: ExpansionStopped | undefined
    await streamExpansion(req, {
      onNodeBatch: (b) => batches.push(b),
      onStopped: (s) => {
        stopped = s
      },
    })

    expect(batches).toHaveLength(2)
    expect(batches[0]?.parentId).toBeNull()
    expect(batches[1]).toMatchObject({ parentId: 'n1', depth: 1 })
    expect(stopped).toEqual({ reason: 'max_depth', totalNodes: 2 })
  })

  it('error イベントを onError へ渡す', async () => {
    stubSSE(
      'event: error\ndata: {"code":"RATE_LIMITED","message":"混雑しています。","retryable":true}\n\n',
    )
    let error: ExpansionError | undefined
    await streamExpansion(req, {
      onError: (e) => {
        error = e
      },
    })
    expect(error).toMatchObject({ code: 'RATE_LIMITED', retryable: true })
  })

  it('非 2xx（409）は ApiError として throw する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: 'CONFLICT', message: '実行中です。', retryable: true },
            }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          ),
      ),
    )
    await expect(streamExpansion(req, {})).rejects.toMatchObject({
      name: 'ApiError',
      code: 'CONFLICT',
      status: 409,
    })
  })

  it('中断（AbortSignal）後の fetch reject は正常終了として扱う', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('Aborted', 'AbortError')
      }),
    )
    await expect(streamExpansion(req, {}, controller.signal)).resolves.toBeUndefined()
  })

  it('スキーマに合わないフレームは該当ハンドラを呼ばない（前方互換・握り潰さない）', async () => {
    stubSSE('event: node-batch\ndata: {"unexpected":true}\n\n')
    const onNodeBatch = vi.fn()
    await streamExpansion(req, { onNodeBatch })
    expect(onNodeBatch).not.toHaveBeenCalled()
  })

  it('ネットワーク不通（中断でない）は ApiError(NETWORK) になる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(streamExpansion(req, {})).rejects.toBeInstanceOf(ApiError)
  })
})
