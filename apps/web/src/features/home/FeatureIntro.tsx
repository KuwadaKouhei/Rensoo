// 未ログイン時の機能紹介（M6・T19）。3 つの特徴カードを表示する（デザイン準拠）。

interface Feature {
  readonly icon: React.ReactNode
  readonly title: string
  readonly body: string
}

/** アイコンの共通枠。 */
const IconFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4 flex size-10 items-center justify-center rounded-[11px] border border-border bg-mm-kid-bg">
    {children}
  </div>
)

const FEATURES: readonly Feature[] = [
  {
    icon: (
      <IconFrame>
        <span
          className="size-3.5 rounded-full"
          style={{ background: 'linear-gradient(135deg, var(--mm-root-a), var(--mm-root-b))' }}
        />
      </IconFrame>
    ),
    title: 'AIが自動で連想',
    body: 'キーワードを入れるだけで、AIが関連語を次々に生成。発想の枝を自動で広げます。',
  },
  {
    icon: (
      <IconFrame>
        <span className="h-0.5 w-4 bg-mm-accent shadow-[0_5px_0_var(--mm-accent),0_-5px_0_var(--mm-accent)]" />
      </IconFrame>
    ),
    title: 'ツリーで整理',
    body: '生成されたノードはサイドバーのツリーで一覧。構造を俯瞰しながら編集できます。',
  },
  {
    icon: (
      <IconFrame>
        <span className="h-4 w-[13px] rounded-[3px] border-[1.5px] border-mm-accent" />
      </IconFrame>
    ),
    title: '保存して再編集',
    body: 'ログインすればマップを保存。いつでも呼び出して再生成・編集を続けられます。',
  },
]

export const FeatureIntro = () => (
  <div className="mx-auto max-w-[960px] px-6 pb-20 pt-12 md:px-10">
    <h2 className="mb-5 text-center text-xl font-bold">このアプリでできること</h2>
    <div className="grid gap-[18px] md:grid-cols-3">
      {FEATURES.map((f) => (
        <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
          {f.icon}
          <h3 className="mb-2 text-base font-bold">{f.title}</h3>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">{f.body}</p>
        </div>
      ))}
    </div>
  </div>
)
