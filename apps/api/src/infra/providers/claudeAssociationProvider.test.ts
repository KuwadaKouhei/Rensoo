import { describe, expect, it } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { AssociationProviderError } from '@rensoo/shared'
import { ClaudeAssociationProvider } from './claudeAssociationProvider'

/** text ブロック1つだけを返す Message 風オブジェクトを作る。 */
const messageWithText = (text: string): Anthropic.Message =>
  ({ content: [{ type: 'text', text }] }) as unknown as Anthropic.Message

/** create が指定の挙動をする Anthropic クライアントのスタブ。 */
const stubClient = (create: () => Promise<Anthropic.Message>): Anthropic =>
  ({ messages: { create } }) as unknown as Anthropic

/** SDK エラーのインスタンス（prototype だけ差し替えて instanceof を成立させる）。 */
const errorOf = <T>(proto: object): T => Object.create(proto) as T

const req = { input: '宇宙', count: 6, locale: 'ja' } as const

describe('ClaudeAssociationProvider', () => {
  it('正常な JSON 応答を整形済みの連想語に変換する（meta 付き）', async () => {
    const provider = new ClaudeAssociationProvider(
      stubClient(async () =>
        messageWithText(JSON.stringify({ words: [{ word: '銀河' }, { word: '惑星' }] })),
      ),
    )

    const result = await provider.associate(req)

    expect(result.words.map((w) => w.word)).toEqual(['銀河', '惑星'])
    expect(result.meta).toEqual({ provider: 'claude', model: 'claude-haiku-4-5' })
  })

  it('options.model で使用モデルを差し替えられる', async () => {
    const provider = new ClaudeAssociationProvider(
      stubClient(async () => messageWithText('{"words":[{"word":"星"}]}')),
      { model: 'claude-opus-4-8' },
    )
    const result = await provider.associate(req)
    expect(result.meta?.model).toBe('claude-opus-4-8')
  })

  it('JSON として解釈できない応答は invalid_response として throw する', async () => {
    const provider = new ClaudeAssociationProvider(
      stubClient(async () => messageWithText('これはJSONではありません')),
    )
    await expect(provider.associate(req)).rejects.toMatchObject({
      name: 'AssociationProviderError',
      kind: 'invalid_response',
      retryable: false,
    })
  })

  it('スキーマに一致しない応答は invalid_response として throw する', async () => {
    const provider = new ClaudeAssociationProvider(
      stubClient(async () => messageWithText('{"items":[]}')),
    )
    await expect(provider.associate(req)).rejects.toMatchObject({ kind: 'invalid_response' })
  })

  it('RateLimitError を rate_limit(retryable) に分類する', async () => {
    const provider = new ClaudeAssociationProvider(
      stubClient(async () => {
        throw errorOf<Anthropic.RateLimitError>(Anthropic.RateLimitError.prototype)
      }),
    )
    await expect(provider.associate(req)).rejects.toMatchObject({
      kind: 'rate_limit',
      retryable: true,
    })
  })

  it('APIConnectionError を timeout(retryable) に分類する', async () => {
    const provider = new ClaudeAssociationProvider(
      stubClient(async () => {
        throw errorOf<Anthropic.APIConnectionError>(Anthropic.APIConnectionError.prototype)
      }),
    )
    await expect(provider.associate(req)).rejects.toMatchObject({
      kind: 'timeout',
      retryable: true,
    })
  })

  it('想定外のエラーは unknown(非 retryable) に分類する', async () => {
    const provider = new ClaudeAssociationProvider(
      stubClient(async () => {
        throw new Error('boom')
      }),
    )
    await expect(provider.associate(req)).rejects.toMatchObject({
      kind: 'unknown',
      retryable: false,
    })
  })

  it('分類結果は AssociationProviderError のインスタンスである', async () => {
    const provider = new ClaudeAssociationProvider(
      stubClient(async () => {
        throw new Error('boom')
      }),
    )
    await expect(provider.associate(req)).rejects.toBeInstanceOf(AssociationProviderError)
  })
})
