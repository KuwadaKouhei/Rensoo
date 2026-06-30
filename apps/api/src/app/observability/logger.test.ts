import { describe, expect, it } from 'vitest'
import { buildLogLine, redactFields } from './logger'

describe('redactFields', () => {
  it('機微キー（authorization/token/apiKey 等）の値を除外する（AC-13）', () => {
    const out = redactFields({
      authorization: 'Bearer secret',
      token: 'jwt-xyz',
      apiKey: 'sk-ant-xxx',
      password: 'p',
      reason: 'max_nodes',
      totalNodes: 12,
    })
    expect(out).toEqual({ reason: 'max_nodes', totalNodes: 12 })
  })

  it('undefined のフィールドは落とす', () => {
    expect(redactFields({ a: undefined, b: 1 })).toEqual({ b: 1 })
  })
})

describe('buildLogLine', () => {
  it('level/event/timestamp とフィールドを含む JSON 1 行を作る', () => {
    const line = buildLogLine(
      'info',
      'expansion.finish',
      { reason: 'completed', totalNodes: 5, token: 'secret' },
      '2026-06-30T00:00:00Z',
    )
    const parsed = JSON.parse(line) as Record<string, unknown>
    expect(parsed).toMatchObject({
      level: 'info',
      event: 'expansion.finish',
      timestamp: '2026-06-30T00:00:00Z',
      reason: 'completed',
      totalNodes: 5,
    })
    // 機微情報は含めない。
    expect(line).not.toContain('secret')
    expect(parsed).not.toHaveProperty('token')
  })
})
