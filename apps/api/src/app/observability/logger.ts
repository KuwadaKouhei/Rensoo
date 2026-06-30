// 構造化ログ（DESIGN §8.4/§8.5）。コール数・所要時間・停止理由などを JSON 1 行で出す。
// 機微情報（JWT/API キー/Authorization 等）はキー名で検出して除外する（AC-13 / NFR-5）。

/** ログに載せられる値（プリミティブのみ。オブジェクトは載せない＝誤って機微情報を出さない）。 */
export type LogValue = string | number | boolean | null | undefined
export type LogFields = Record<string, LogValue>

/** 機微情報とみなすキー（小文字・部分一致）。値はログに出さない。 */
const SECRET_KEY_PATTERNS = [
  'authorization',
  'token',
  'apikey',
  'api_key',
  'password',
  'secret',
  'cookie',
]

const isSecretKey = (key: string): boolean => {
  const lower = key.toLowerCase()
  return SECRET_KEY_PATTERNS.some((p) => lower.includes(p))
}

/** 機微キーを除外したフィールドを返す（undefined も落とす）。 */
export const redactFields = (fields: LogFields): LogFields => {
  const out: LogFields = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (isSecretKey(key)) continue
    out[key] = value
  }
  return out
}

/** ログ1行を組み立てる（テスト用に分離。timestamp は呼び出し側で付与可能）。 */
export const buildLogLine = (
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: LogFields,
  timestamp: string,
): string => JSON.stringify({ level, event, timestamp, ...redactFields(fields) })

const emit = (level: 'info' | 'warn' | 'error', event: string, fields: LogFields): void => {
  const line = buildLogLine(level, event, fields, new Date().toISOString())
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logInfo = (event: string, fields: LogFields = {}): void => emit('info', event, fields)
export const logWarn = (event: string, fields: LogFields = {}): void => emit('warn', event, fields)
export const logError = (event: string, fields: LogFields = {}): void =>
  emit('error', event, fields)
