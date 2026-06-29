// 連想ソースの抽象（拡張点）。実装は外側（apps/api/src/infra/providers/）が担い、
// ドメインは具体プロバイダ（Claude 等）を知らない＝依存性逆転（PLAN_PHILOSOPHY / DESIGN §3.1）。

/** 1件の連想語（整形済みドメイン値）。 */
export interface AssociationWord {
  /** 表示テキスト（日本語・トリム済み・非空）。 */
  readonly word: string
}

/** 連想生成の要求。 */
export interface AssociateRequest {
  /** 起点となる語。 */
  readonly input: string
  /** 希望生成件数（3〜10、既定6）。厳密一致は保証せず normalizeAssociations が整形で担保。 */
  readonly count: number
  /** MVP は日本語固定（将来の多言語拡張点）。 */
  readonly locale: 'ja'
}

/** 連想生成の結果（整形前のプロバイダ生出力に近い段階）。 */
export interface AssociateResult {
  readonly words: readonly AssociationWord[]
  readonly meta?: {
    /** 'claude' 等（ロギング/可観測性用）。 */
    readonly provider: string
    readonly model?: string
  }
}

/** 連想ソースの抽象。実装: ClaudeAssociationProvider など。 */
export interface AssociationProvider {
  /**
   * 入力語から連想語リストを生成する。
   * - プロバイダ呼び出しの失敗は AssociationProviderError として throw（握りつぶさない）。
   * - 件数の厳密一致は保証しない（構造化出力は配列長の数値制約非対応のため）。
   *   件数調整・重複/空/無関係除去はドメインの整形ロジック（normalizeAssociations）が担う。
   */
  associate(req: AssociateRequest): Promise<AssociateResult>
}

/** プロバイダ起因の失敗の種別。呼び出し側が再試行/分類に使う。 */
export type AssociationProviderErrorKind =
  | 'rate_limit'
  | 'timeout'
  | 'invalid_response'
  | 'upstream'
  | 'unknown'

/** プロバイダ起因の失敗を表す型付きエラー（握りつぶさず再スローするための土台・CODING_PHILOSOPHY）。 */
export class AssociationProviderError extends Error {
  constructor(
    message: string,
    readonly kind: AssociationProviderErrorKind,
    readonly retryable: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'AssociationProviderError'
  }
}
