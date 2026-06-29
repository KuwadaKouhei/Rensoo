import Anthropic from '@anthropic-ai/sdk'
import {
  AssociationProviderError,
  llmAssociationResponseSchema,
  type AssociateRequest,
  type AssociateResult,
  type AssociationProvider,
} from '@rensoo/shared'

/** 既定モデル（TECH_STACK/DESIGN: 安価な Haiku を採用）。 */
const DEFAULT_MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 1024

const SYSTEM_PROMPT =
  'あなたは日本語の連想語を生成するアシスタントです。' +
  '与えられた語から日本語で自然に連想される語を生成し、必ず指定された JSON 形式のみを出力してください。' +
  '説明文・前置き・マークダウンのコードフェンスは一切出力しないこと。'

const buildUserPrompt = (req: AssociateRequest): string =>
  `語「${req.input}」から連想される日本語の語を${req.count}個生成してください。` +
  '出力は次の JSON 形式のみ: {"words":[{"word":"..."}]}。' +
  '入力語そのものは含めないでください。'

export interface ClaudeAssociationProviderOptions {
  readonly model?: string
}

/**
 * AssociationProvider の Claude 実装（拡張点・DESIGN §3.1）。
 * Anthropic SDK 呼び出しをこの infra 層に閉じ込め、API キーはサーバー環境変数でのみ扱う（AC-13/NFR-5）。
 *
 * MVP では「プロンプトで JSON 形式を指定 → 受信テキストを JSON 解釈 → Zod で厳格検証」する。
 * SDK の構造化出力（output_config.format）はバージョン確認後の堅牢化として導入余地を残す
 * （いずれにせよ外部入出力は Zod 検証する: CODING_PHILOSOPHY）。
 */
export class ClaudeAssociationProvider implements AssociationProvider {
  private readonly model: string

  constructor(
    private readonly client: Anthropic,
    options: ClaudeAssociationProviderOptions = {},
  ) {
    this.model = options.model ?? DEFAULT_MODEL
  }

  async associate(req: AssociateRequest): Promise<AssociateResult> {
    let message: Anthropic.Message
    try {
      message = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(req) }],
      })
    } catch (err) {
      throw toProviderError(err)
    }

    const parsed = parseAndValidate(extractText(message))
    return {
      words: parsed.words.map((w) => ({ word: w.word })),
      meta: { provider: 'claude', model: this.model },
    }
  }
}

/** Message の text ブロックを連結して取り出す。 */
const extractText = (message: Anthropic.Message): string =>
  message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

/** テキストから JSON 部分を取り出し、共有スキーマで厳格検証する。失敗は invalid_response。 */
const parseAndValidate = (text: string) => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')

  let json: unknown
  try {
    if (start === -1 || end === -1 || end < start) {
      throw new SyntaxError('JSON オブジェクトが見つかりません')
    }
    json = JSON.parse(text.slice(start, end + 1))
  } catch (err) {
    throw new AssociationProviderError(
      'LLM 応答を JSON として解釈できませんでした',
      'invalid_response',
      false,
      { cause: err },
    )
  }

  const result = llmAssociationResponseSchema.safeParse(json)
  if (!result.success) {
    throw new AssociationProviderError(
      'LLM 応答が想定スキーマに一致しませんでした',
      'invalid_response',
      false,
      { cause: result.error },
    )
  }
  return result.data
}

/** Anthropic SDK のエラーを型付きの AssociationProviderError に分類する（握りつぶさない）。 */
const toProviderError = (err: unknown): AssociationProviderError => {
  if (err instanceof AssociationProviderError) return err
  if (err instanceof Anthropic.RateLimitError) {
    return new AssociationProviderError('レート制限に達しました', 'rate_limit', true, {
      cause: err,
    })
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AssociationProviderError('LLM への接続に失敗しました', 'timeout', true, {
      cause: err,
    })
  }
  if (err instanceof Anthropic.APIError) {
    const status = (err as { status?: number }).status
    const retryable = typeof status === 'number' ? status >= 500 || status === 429 : true
    return new AssociationProviderError('上流 LLM がエラーを返しました', 'upstream', retryable, {
      cause: err,
    })
  }
  return new AssociationProviderError('連想生成で不明なエラーが発生しました', 'unknown', false, {
    cause: err,
  })
}
