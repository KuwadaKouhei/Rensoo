// ホーム画面（M6・DESIGN §2.1.1）。ヘッダー＋ヒーロー（キーワード入力→「生成する」で編集画面へ遷移し生成開始）。
// 未ログイン=機能紹介／ログイン=保存マップ一覧の出し分けは T19 で追加する。

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/button'

/** ヒーローのクイックピック候補。 */
const QUICK_PICKS = ['コーヒー', '宇宙', '旅行', '音楽'] as const

export const HomePage = () => {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')

  /** 起点キーワードを持って編集画面へ遷移し、生成を開始する。 */
  const generate = (value: string): void => {
    const kw = value.trim()
    if (!kw) return
    navigate('/map', { state: { keyword: kw } })
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    generate(keyword)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />

      <section className="mx-auto max-w-[780px] px-6 pb-10 pt-16 text-center md:px-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-[12.5px] font-semibold tracking-wide text-mm-accent">
          <span className="size-1.5 rounded-full bg-mm-accent" />
          AIマインドマップジェネレーター
        </div>

        <h1 className="mt-6 text-4xl font-bold leading-[1.14] tracking-tight md:text-5xl">
          キーワードから、
          <br />
          思考を広げる。
        </h1>
        <p className="mx-auto mt-5 max-w-[520px] text-[17px] leading-relaxed text-muted-foreground">
          好きな言葉を入力して生成するだけ。AIが連想をつなげ、あなたの発想をマインドマップに描き出します。
        </p>

        <form
          onSubmit={submit}
          className="mt-9 flex gap-2.5 rounded-2xl border border-border bg-card p-2.5 shadow-[0_18px_50px_var(--mm-shadow)]"
        >
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="例：コーヒー、宇宙、旅行…"
            aria-label="連想の起点キーワード"
            className="flex-1 bg-transparent px-4 py-3 text-lg outline-none placeholder:text-muted-foreground/75"
          />
          <Button type="submit" size="lg" className="px-8 text-base font-bold">
            生成する
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap justify-center gap-2.5">
          <span className="self-center text-[13px] text-muted-foreground">試す：</span>
          {QUICK_PICKS.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => setKeyword(word)}
              className="rounded-full border border-border px-3.5 py-1.5 text-[13.5px] transition-colors hover:bg-card"
            >
              {word}
            </button>
          ))}
        </div>

        <div className="mt-6 inline-flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="inline-flex size-4 items-center justify-center rounded-full border border-mm-accent text-[11px] font-bold text-mm-accent">
            ✓
          </span>
          ログインなしでも、すぐに生成できます
        </div>
      </section>
    </div>
  )
}
