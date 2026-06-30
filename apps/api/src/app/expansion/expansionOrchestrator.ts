// 自走展開オーケストレータ（BFS・DESIGN §6.2/§6.5）。
// AssociationProvider にのみ依存し（具体 LLM 実装は知らない・依存性逆転）、停止条件・整形・
// 重複除去・中断・リトライを束ねて SSE 用イベントを emit する。
//
// コスト保護: キュー投入「前」に shouldStopExpansion で判定し、上限を厳密に守る（NFR-3）。
// 中断（接続クローズ）: signal.aborted を各ステップで確認し、追加の LLM 呼び出しを行わず停止する（AC-6）。

import {
  AssociationProviderError,
  normalizeAssociations,
  type AssociationProvider,
  type ExpansionNode,
  type ExpansionStopReason,
  type GenerationSettings,
} from '@rensoo/shared'
import { shouldStopExpansion } from '../../domain/expansion/shouldStopExpansion.js'
import { withRetry, type RetryOptions } from './rateLimiter.js'

/** オーケストレータが emit する内部イベント（SSE 名はルート層で付与）。 */
export type ExpansionEvent =
  | {
      readonly type: 'node-batch'
      readonly parentId: string | null
      readonly depth: number
      readonly nodes: readonly ExpansionNode[]
    }
  | { readonly type: 'progress'; readonly totalNodes: number; readonly depth: number }
  | { readonly type: 'stopped'; readonly reason: ExpansionStopReason; readonly totalNodes: number }
  | {
      readonly type: 'error'
      readonly code: string
      readonly message: string
      readonly retryable: boolean
    }

/** 中断フラグ（接続クローズ時に aborted=true をセットする）。 */
export interface AbortSignalLike {
  readonly aborted: boolean
}

export interface ExpansionDeps {
  readonly provider: AssociationProvider
  /** イベント送出（SSE 書き込み等）。失敗時は呼び出し側で処理。 */
  readonly emit: (event: ExpansionEvent) => Promise<void> | void
  /** 中断フラグ。 */
  readonly signal: AbortSignalLike
  /** リトライ設定（テストで sleep を no-op 注入可能）。 */
  readonly retry?: RetryOptions
  /** ノード ID 採番（既定は n1, n2, ... の決定的カウンタ）。 */
  readonly createId?: () => string
}

interface QueuedNode {
  readonly id: string
  readonly text: string
  readonly depth: number
}

/** 既定のノード ID 採番器（n1, n2, ...）。フロントの起点 ID 規約（n1）と一致させる。 */
const defaultIdFactory = (): (() => string) => {
  let seq = 0
  return () => {
    seq += 1
    return `n${seq}`
  }
}

/**
 * 起点キーワードから BFS で自走展開する。
 * 1) 起点ノード（depth=0）を作成・emit。
 * 2) キューが空になるまで、各ノードについて停止判定→連想生成→整形→子ノード生成→emit。
 * 3) 停止条件到達・中断・自然終了で stopped を emit して終了。
 */
export const runExpansion = async (
  rootInput: string,
  settings: GenerationSettings,
  deps: ExpansionDeps,
): Promise<void> => {
  const createId = deps.createId ?? defaultIdFactory()
  const limits = { maxNodes: settings.maxNodes, maxDepth: settings.maxDepth }

  const rootText = rootInput.trim()
  const rootId = createId()
  let totalNodes = 1
  // マップ全体での重複ノードを防ぐ（フロントのストア整合と一致させ、件数カウントを正確に保つ）。
  const seenTexts = new Set<string>([rootText])

  await deps.emit({
    type: 'node-batch',
    parentId: null,
    depth: 0,
    nodes: [{ id: rootId, text: rootText }],
  })
  await deps.emit({ type: 'progress', totalNodes, depth: 0 })

  const queue: QueuedNode[] = [{ id: rootId, text: rootText, depth: 0 }]

  while (queue.length > 0) {
    if (deps.signal.aborted) {
      await deps.emit({ type: 'stopped', reason: 'user_stop', totalNodes })
      return
    }

    const node = queue.shift()!
    const nextDepth = node.depth + 1

    const decision = shouldStopExpansion({ currentTotalNodes: totalNodes, nextDepth }, limits)
    if (decision.stop) {
      // BFS は depth 昇順に処理するため、ここで止めれば残りも展開されない（確実に停止）。
      await deps.emit({ type: 'stopped', reason: decision.reason ?? 'completed', totalNodes })
      return
    }

    let words
    try {
      const result = await withRetry(
        () =>
          deps.provider.associate({ input: node.text, count: settings.countPerNode, locale: 'ja' }),
        deps.retry,
      )
      words = normalizeAssociations(result.words, {
        input: node.text,
        count: settings.countPerNode,
      })
    } catch (err) {
      const mapped = toErrorEvent(err)
      await deps.emit(mapped)
      await deps.emit({ type: 'stopped', reason: 'user_stop', totalNodes })
      return
    }

    // 上限を厳密に守る: 残り許容数とグローバル重複除去でフィルタしてから採番する。
    const remaining = Math.max(0, limits.maxNodes - totalNodes)
    const childNodes: ExpansionNode[] = []
    for (const { word } of words) {
      if (childNodes.length >= remaining) break
      if (seenTexts.has(word)) continue
      seenTexts.add(word)
      childNodes.push({ id: createId(), text: word })
    }

    if (childNodes.length > 0) {
      totalNodes += childNodes.length
      await deps.emit({
        type: 'node-batch',
        parentId: node.id,
        depth: nextDepth,
        nodes: childNodes,
      })
      await deps.emit({ type: 'progress', totalNodes, depth: nextDepth })
      for (const child of childNodes) {
        queue.push({ id: child.id, text: child.text, depth: nextDepth })
      }
    }

    if (totalNodes >= limits.maxNodes) {
      await deps.emit({ type: 'stopped', reason: 'max_nodes', totalNodes })
      return
    }
  }

  await deps.emit({ type: 'stopped', reason: 'completed', totalNodes })
}

/** プロバイダ失敗を SSE error イベント（日本語・内部情報なし）に写像する。 */
const toErrorEvent = (err: unknown): Extract<ExpansionEvent, { type: 'error' }> => {
  if (err instanceof AssociationProviderError) {
    if (err.kind === 'rate_limit') {
      return {
        type: 'error',
        code: 'RATE_LIMITED',
        message: 'リクエストが集中しています。しばらくして再試行してください。',
        retryable: true,
      }
    }
    if (err.kind === 'timeout' || err.kind === 'upstream') {
      return {
        type: 'error',
        code: 'UPSTREAM_LLM',
        message: '連想の生成に失敗しました。しばらくして再試行してください。',
        retryable: err.retryable,
      }
    }
  }
  return {
    type: 'error',
    code: 'INTERNAL',
    message: '自走展開中にエラーが発生しました。',
    retryable: false,
  }
}
