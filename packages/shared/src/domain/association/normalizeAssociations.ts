import type { AssociationWord } from './associationProvider.js'

/**
 * プロバイダ生出力を「重複/空/無関係を除去し、件数に合わせて整形」する純粋関数。
 * プロバイダ非依存・副作用なしでテスト可能（PLAN/TEST_PHILOSOPHY）。
 *
 * - 各語をトリムし、空文字は除去（FR-5）。
 * - 入力語自身（トリム比較）は連想結果から除去（FR-5）。
 * - 重複（トリム後の同一表記）は先勝ちで除去（FR-5）。
 * - `count` を超えた分はトリム。不足は許容（不足時の再生成はオーケストレータの判断・DESIGN §6）。
 *
 * @returns 整形済みの確定連想語リスト（入力順を保持）。
 */
export function normalizeAssociations(
  raw: readonly AssociationWord[],
  params: { readonly input: string; readonly count: number },
): readonly AssociationWord[] {
  const inputKey = params.input.trim()
  const seen = new Set<string>()
  const result: AssociationWord[] = []

  for (const item of raw) {
    if (result.length >= params.count) break // count 超過はトリム

    const word = item.word.trim()
    if (word.length === 0) continue // 空除去
    if (word === inputKey) continue // 入力語自身を除去
    if (seen.has(word)) continue // 重複除去（先勝ち）

    seen.add(word)
    result.push({ word })
  }

  return result
}
