import { test, expect } from '@playwright/test'

// ハッピーパス（M6 2 画面）: ホームでキーワード→「生成する」→編集画面へ遷移→自走展開（SSE）→
// ノード描画→停止理由表示（AC-1,2,3）。自走展開 API は SSE をモックする（実 LLM 不要・決定的）。
// 保存/ログインは Supabase 実環境が必要なためステージング/手動 E2E で確認する（本 spec はゲスト中心）。

const SSE_FRAMES = [
  'event: node-batch',
  'data: {"parentId":null,"depth":0,"nodes":[{"id":"n1","text":"宇宙"}]}',
  '',
  'event: progress',
  'data: {"totalNodes":1,"depth":0}',
  '',
  'event: node-batch',
  'data: {"parentId":"n1","depth":1,"nodes":[{"id":"n2","text":"銀河"},{"id":"n3","text":"惑星"}]}',
  '',
  'event: progress',
  'data: {"totalNodes":3,"depth":1}',
  '',
  'event: stopped',
  'data: {"reason":"completed","totalNodes":3}',
  '',
  '',
].join('\n')

test('キーワードから自走展開してマインドマップが描画される', async ({ page }) => {
  // 自走展開 SSE をスタブ（実 LLM を叩かない）。
  await page.route('**/api/expansion/stream', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: SSE_FRAMES,
    })
  })

  await page.goto('/')

  // ホームのヒーローで起点キーワードを入力し「生成する」→編集画面（/map）へ遷移し生成が自動開始する。
  await page.getByLabel('連想の起点キーワード').fill('宇宙')
  await page.getByRole('button', { name: '生成する' }).click()
  await expect(page).toHaveURL(/\/map$/)

  // 起点と連想ノードが描画される（React Flow のノードラベル）。
  await expect(page.getByText('宇宙')).toBeVisible()
  await expect(page.getByText('銀河')).toBeVisible()
  await expect(page.getByText('惑星')).toBeVisible()

  // 停止理由が日本語で表示される。
  await expect(page.getByText('展開が完了しました。')).toBeVisible()
})
