import { describe, expect, it, vi } from 'vitest'
import {
  AssociationProviderError,
  type AssociateResult,
  type AssociationProvider,
} from '@rensoo/shared'
import { runExpansion, type ExpansionEvent } from './expansionOrchestrator'

const noSleep = async (): Promise<void> => {}
const retry = { sleep: noSleep }

/** 各 associate 呼び出しで固定の語リストを返すスタブ Provider。 */
const stubProvider = (words: string[]): AssociationProvider => ({
  associate: async (): Promise<AssociateResult> => ({
    words: words.map((word) => ({ word })),
    meta: { provider: 'stub' },
  }),
})

/** emit を配列に集めるシンク。 */
const collector = () => {
  const events: ExpansionEvent[] = []
  return { events, emit: (e: ExpansionEvent) => void events.push(e) }
}

const settings = (over: Partial<{ countPerNode: number; maxDepth: number; maxNodes: number }>) => ({
  countPerNode: 6,
  maxDepth: 3,
  maxNodes: 50,
  ...over,
})

describe('runExpansion', () => {
  it('起点ノードを最初に emit する（parentId=null, depth=0）', async () => {
    const { events, emit } = collector()
    await runExpansion('宇宙', settings({ maxDepth: 0 }), {
      provider: stubProvider(['銀河']),
      emit,
      signal: { aborted: false },
      retry,
    })
    expect(events[0]).toEqual({
      type: 'node-batch',
      parentId: null,
      depth: 0,
      nodes: [{ id: 'n1', text: '宇宙' }],
    })
  })

  it('maxDepth で自動停止する（深さ超過の枝は展開しない・AC-3）', async () => {
    const { events, emit } = collector()
    const provider = stubProvider(['銀河', '惑星'])
    const spy = vi.spyOn(provider, 'associate')

    await runExpansion('宇宙', settings({ maxDepth: 1, maxNodes: 100 }), {
      provider,
      emit,
      signal: { aborted: false },
      retry,
    })

    // 起点(depth0)のみ展開 → depth1 の2ノード生成 → depth1 ノードは nextDepth=2>1 で停止。
    const stopped = events.find((e) => e.type === 'stopped')
    expect(stopped).toEqual({ type: 'stopped', reason: 'max_depth', totalNodes: 3 })
    // associate は起点に対して1回だけ（depth1 ノードは展開されない）。
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('maxNodes で自動停止し、上限を超えて生成しない（NFR-3）', async () => {
    const { events, emit } = collector()
    await runExpansion('宇宙', settings({ maxNodes: 3, maxDepth: 5 }), {
      provider: stubProvider(['a', 'b', 'c', 'd', 'e']),
      emit,
      signal: { aborted: false },
      retry,
    })

    const totals = events.filter((e) => e.type === 'progress').map((e) => e.totalNodes)
    expect(Math.max(...totals)).toBe(3) // 起点 + 2 で上限ちょうど
    const stopped = events.find((e) => e.type === 'stopped')
    expect(stopped).toMatchObject({ reason: 'max_nodes', totalNodes: 3 })
  })

  it('中断（signal.aborted）後は追加の LLM 呼び出しをせず user_stop で止まる（AC-6）', async () => {
    const provider = stubProvider(['銀河', '惑星'])
    const spy = vi.spyOn(provider, 'associate')
    const events: ExpansionEvent[] = []
    const signal = { aborted: false }
    // 最初の node-batch（起点）を見たら中断要求する。
    const emit = (e: ExpansionEvent): void => {
      events.push(e)
      if (e.type === 'progress' && e.depth === 0) {
        ;(signal as { aborted: boolean }).aborted = true
      }
    }

    await runExpansion('宇宙', settings({}), { provider, emit, signal, retry })

    expect(spy).not.toHaveBeenCalled() // 起点 emit 直後に中断 → associate されない
    expect(events.at(-1)).toEqual({ type: 'stopped', reason: 'user_stop', totalNodes: 1 })
  })

  it('マップ全体で重複ノードを除去する（件数カウントが正確）', async () => {
    const { events, emit } = collector()
    // 起点「宇宙」、子は重複「星」を含む。さらに孫でも「星」が出ても再追加しない。
    await runExpansion('宇宙', settings({ maxNodes: 100, maxDepth: 2, countPerNode: 6 }), {
      provider: stubProvider(['星', '星', '宇宙', '銀河']),
      emit,
      signal: { aborted: false },
      retry,
    })

    const texts = events
      .filter((e) => e.type === 'node-batch')
      .flatMap((e) => e.nodes.map((n) => n.text))
    // 重複「星」と入力語「宇宙」は1度だけ（起点）。ユニークであること。
    expect(new Set(texts).size).toBe(texts.length)
    expect(texts.filter((t) => t === '星')).toHaveLength(1)
  })

  it('リトライ不能なプロバイダ失敗は error イベント＋停止（日本語・内部情報なし）', async () => {
    const failing: AssociationProvider = {
      associate: async () => {
        throw new AssociationProviderError('secret', 'invalid_response', false)
      },
    }
    const { events, emit } = collector()
    await runExpansion('宇宙', settings({}), {
      provider: failing,
      emit,
      signal: { aborted: false },
      retry,
    })

    const error = events.find((e) => e.type === 'error')
    expect(error).toMatchObject({ code: 'INTERNAL', retryable: false })
    expect(JSON.stringify(events)).not.toContain('secret')
    // エラー由来の停止は reason='error'（user_stop と区別・可観測性）。
    expect(events.at(-1)).toMatchObject({ type: 'stopped', reason: 'error' })
  })

  it('rate_limit 失敗は RATE_LIMITED(retryable) の error になる', async () => {
    const failing: AssociationProvider = {
      associate: async () => {
        throw new AssociationProviderError('rate', 'rate_limit', true)
      },
    }
    const { events, emit } = collector()
    await runExpansion('宇宙', settings({}), {
      provider: failing,
      emit,
      signal: { aborted: false },
      retry: { retries: 0, sleep: noSleep },
    })
    expect(events.find((e) => e.type === 'error')).toMatchObject({
      code: 'RATE_LIMITED',
      retryable: true,
    })
  })

  it('連想語が0件なら自然終了（completed）する', async () => {
    const { events, emit } = collector()
    await runExpansion('宇宙', settings({ maxDepth: 3 }), {
      provider: stubProvider([]),
      emit,
      signal: { aborted: false },
      retry,
    })
    expect(events.at(-1)).toEqual({ type: 'stopped', reason: 'completed', totalNodes: 1 })
  })
})
