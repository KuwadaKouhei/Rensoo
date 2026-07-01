// ホームのヒーロー（M6・T19）。キーワード入力→「生成する」で生成を開始する（遷移は呼び出し側）。
// 見た目は MindWeave デザイン準拠。ドメイン操作は持たず、onGenerate に委譲する。

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'

/** クイックピック候補。 */
const QUICK_PICKS = ['コーヒー', '宇宙', '旅行', '音楽'] as const

export interface HeroProps {
  /** 起点キーワードで生成を開始する（空文字は呼ばれない）。 */
  readonly onGenerate: (keyword: string) => void
}

export const Hero = ({ onGenerate }: HeroProps) => {
  const [keyword, setKeyword] = useState('')

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const kw = keyword.trim()
    if (kw) onGenerate(kw)
  }

  return (
    <section className="mx-auto max-w-[780px] px-6 pb-2 pt-16 text-center md:px-10">
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
  )
}
