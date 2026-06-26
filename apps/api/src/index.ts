import { serve } from '@hono/node-server'
import { Hono } from 'hono'

// T01 は「最小で起動可能な空サーバー」。ルーティング層・DI 配線・連想 API は T04 以降で実装する。
const app = new Hono()

app.get('/', (c) => c.text('Rensoo API'))

const port = Number(process.env.PORT ?? 8787)

serve({ fetch: app.fetch, port }, (info) => {
  // 起動ログ（ユーザー向けメッセージは日本語: CODING_PHILOSOPHY）
  console.log(`Rensoo API サーバーを起動しました: http://localhost:${info.port}`)
})
