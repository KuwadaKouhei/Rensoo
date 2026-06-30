import { describe, expect, it } from 'vitest'
import { type AssociateResult, type AssociationProvider } from '@rensoo/shared'
import { createApp } from '../app'

const stubProvider = (words: string[]): AssociationProvider => ({
  associate: async (): Promise<AssociateResult> => ({
    words: words.map((word) => ({ word })),
    meta: { provider: 'stub' },
  }),
})

/** 解決しない associate（実行中ロックを保持させるため）。 */
const hangingProvider = (): AssociationProvider => ({
  associate: () => new Promise<AssociateResult>(() => {}),
})

const post = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.request('/api/expansion/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

/** SSE テキストから event 行を抽出する。 */
const eventNames = (sse: string): string[] =>
  sse
    .split('\n')
    .filter((line) => line.startsWith('event:'))
    .map((line) => line.slice('event:'.length).trim())

describe('POST /api/expansion/stream', () => {
  it('SSE で node-batch / progress / stopped が流れ、停止条件で自動停止する（AC-3）', async () => {
    const app = createApp({ associationProvider: stubProvider(['銀河', '惑星']) })
    const res = await post(app, { rootInput: '宇宙', settings: { maxDepth: 1, maxNodes: 100 } })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const text = await res.text()
    const names = eventNames(text)
    expect(names).toContain('node-batch')
    expect(names).toContain('progress')
    expect(names[names.length - 1]).toBe('stopped')
    expect(text).toContain('"reason":"max_depth"')
    // 起点ノードがサーバー採番 id 付きで送られる。
    expect(text).toContain('"parentId":null')
    expect(text).toContain('"id":"n1"')
    expect(text).toContain('宇宙')
  })

  it('空入力は 400 VALIDATION（NFR-7）', async () => {
    const app = createApp({ associationProvider: stubProvider(['x']) })
    const res = await post(app, { rootInput: '', settings: {} })
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('VALIDATION')
  })

  it('同一キーワードの多重実行は 409 CONFLICT（NFR-4）', async () => {
    const app = createApp({ associationProvider: hangingProvider() })
    // 1本目: associate で止まり、ロックを保持し続ける（ストリームは読まない）。
    const first = await post(app, { rootInput: '宇宙', settings: {} })
    expect(first.status).toBe(200)

    // 2本目: 同一キーは即 409。
    const second = await post(app, { rootInput: '宇宙', settings: {} })
    expect(second.status).toBe(409)
    const json = (await second.json()) as { error: { code: string; retryable: boolean } }
    expect(json.error.code).toBe('CONFLICT')
    expect(json.error.retryable).toBe(true)
  })

  it('異なるキーワードはロックが独立し、並行に開始できる', async () => {
    const app = createApp({ associationProvider: hangingProvider() })
    const a = await post(app, { rootInput: '宇宙', settings: {} })
    const b = await post(app, { rootInput: '海', settings: {} })
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
  })
})
