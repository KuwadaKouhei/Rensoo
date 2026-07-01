// ホーム画面（M6・T18/T19・DESIGN §2.1.1/§7.1）。
// ヘッダー＋ヒーロー（キーワード入力→「生成する」で編集画面へ遷移し生成開始）。
// 下部は認証状態で出し分ける: ログイン=保存マップ一覧（開く/削除）、未ログイン=機能紹介。

import { useNavigate } from 'react-router-dom'
import { AppHeader } from '@/components/layout/AppHeader'
import { Hero } from '@/features/home/Hero'
import { FeatureIntro } from '@/features/home/FeatureIntro'
import { HomeMapGrid } from '@/features/home/HomeMapGrid'
import { useAuth } from '@/auth/useAuth'

export const HomePage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  /** 起点キーワードを持って編集画面へ遷移し、生成を開始する（ゲストでも可・AC-8）。 */
  const generate = (keyword: string): void => {
    navigate('/map', { state: { keyword } })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <Hero onGenerate={generate} />
      {user ? <HomeMapGrid /> : <FeatureIntro />}
    </div>
  )
}
