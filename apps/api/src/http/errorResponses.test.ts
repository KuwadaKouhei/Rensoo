import { describe, expect, it } from 'vitest'
import { AppError, ERROR_SPECS, errorBody, errorStatus, type ErrorCode } from './errorResponses'

const ALL_CODES: ErrorCode[] = [
  'VALIDATION',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'UPSTREAM_LLM',
  'INTERNAL',
]

describe('errorResponses', () => {
  it('全コードに日本語メッセージと妥当な HTTP ステータスが定義されている', () => {
    for (const code of ALL_CODES) {
      const spec = ERROR_SPECS[code]
      expect(spec.message.length).toBeGreaterThan(0)
      expect(spec.status).toBeGreaterThanOrEqual(400)
      expect(spec.status).toBeLessThan(600)
    }
  })

  it('再試行可否は仕様どおり（一時的=true / 恒久的=false）', () => {
    expect(ERROR_SPECS.RATE_LIMITED.retryable).toBe(true)
    expect(ERROR_SPECS.UPSTREAM_LLM.retryable).toBe(true)
    expect(ERROR_SPECS.INTERNAL.retryable).toBe(true)
    expect(ERROR_SPECS.VALIDATION.retryable).toBe(false)
    expect(ERROR_SPECS.UNAUTHORIZED.retryable).toBe(false)
    expect(ERROR_SPECS.NOT_FOUND.retryable).toBe(false)
  })

  it('errorBody は既定値を返し、message/retryable を上書きできる', () => {
    expect(errorBody('VALIDATION')).toEqual({
      error: { code: 'VALIDATION', message: ERROR_SPECS.VALIDATION.message, retryable: false },
    })
    expect(errorBody('VALIDATION', { message: '独自' }).error.message).toBe('独自')
    expect(errorBody('RATE_LIMITED', { retryable: false }).error.retryable).toBe(false)
  })

  it('errorStatus は code のステータスを返す', () => {
    expect(errorStatus('NOT_FOUND')).toBe(404)
    expect(errorStatus('CONFLICT')).toBe(409)
  })

  it('AppError は code と既定メッセージを持つ', () => {
    const err = new AppError('NOT_FOUND')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe(ERROR_SPECS.NOT_FOUND.message)
    expect(new AppError('VALIDATION', '個別文言').message).toBe('個別文言')
  })
})
