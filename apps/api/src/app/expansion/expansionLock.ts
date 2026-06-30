// 多重実行抑制（DESIGN §6.4）。同一キー（MVP は起点キーワード）の同時展開を1つに制限する
// インメモリロック。実行中の再要求は acquire 失敗 → ルートで 409 を返す。
//
// MVP はゲスト中心でマップ未永続のためキーに起点キーワードを用いる。
// マップ永続化（T12 以降）後はキーを mapId に変更してマップ単位ロックにする。

export class InMemoryExpansionLock {
  private readonly active = new Set<string>()

  /** ロック取得を試みる。既に実行中なら false。 */
  tryAcquire(key: string): boolean {
    if (this.active.has(key)) {
      return false
    }
    this.active.add(key)
    return true
  }

  /** ロックを解放する（finally で必ず呼ぶ）。 */
  release(key: string): void {
    this.active.delete(key)
  }

  /** テスト/可観測性用: 実行中かどうか。 */
  isActive(key: string): boolean {
    return this.active.has(key)
  }
}
