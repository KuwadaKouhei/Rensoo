// 保存マップの更新日時を「〜前」の相対表記へ整形する純粋関数（M6・T19）。
// now を引数で受けることで Date.now に依存せず決定的にテストできる。

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * ISO8601 の更新日時を相対表記にする。未来・不正値は素の日付にフォールバックする。
 * @param iso 更新日時（ISO8601）
 * @param now 現在時刻（ミリ秒）。テストでは固定値を渡す。
 */
export const formatUpdatedAt = (iso: string, now: number): string => {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const diff = now - t
  if (diff < MINUTE) return 'たった今'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}分前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}時間前`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}日前`
  // 1 週間以上前は年月日で表示する。
  return new Date(t).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
}
