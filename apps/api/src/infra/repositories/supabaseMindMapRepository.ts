// MindMapRepository の Supabase 実装（拡張点・DESIGN §3.2/§7.3・DATABASE §3/§7）。
// **ユーザー JWT を引き継いだクライアント**で発行し、RLS（owner_id = auth.uid()）で本人の行のみに限定する。
// service_role（RLS バイパス）は使わない。Supabase 依存はこの infra 層に閉じ込める。

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  MindMapRepository,
  MindMapSnapshot,
  MindMapSummary,
  SaveMindMapInput,
} from '@rensoo/shared'
// AppError は HTTP 非依存の軽量エラー担体（実行時に hono を引き込まない）。infra から投げ、
// 上位の onError が一貫した応答へ写像する。
import { AppError } from '../../http/errorResponses.js'

const TABLE = 'mindmaps'

/** DB 行（必要カラムのみ）。snapshot は {version,nodes,edges}。 */
interface MindMapRow {
  id: string
  title: string
  updated_at: string
  settings: MindMapSnapshot['settings']
  snapshot: { nodes: MindMapSnapshot['nodes']; edges: MindMapSnapshot['edges'] }
}

/** 起点ノード（depth=0/origin=root、無ければ先頭）のテキストを root_keyword とする。 */
const deriveRootKeyword = (input: SaveMindMapInput): string => {
  const root = input.nodes.find((n) => n.origin === 'root') ?? input.nodes[0]
  return (root?.text ?? input.title).slice(0, 100)
}

export class SupabaseMindMapRepository implements MindMapRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(userId: string): Promise<readonly MindMapSummary[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('id, title, updated_at')
      // RLS に加えアプリ層でも本人限定を明示（多層防御）。
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })
    if (error) {
      throw new Error(`マップ一覧の取得に失敗しました: ${error.message}`)
    }
    return (data ?? []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      updatedAt: row.updated_at as string,
    }))
  }

  async get(userId: string, mapId: string): Promise<MindMapSnapshot | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('id, title, settings, snapshot')
      .eq('id', mapId)
      // RLS が本人限定の砦だが、アプリ層でも owner_id を明示して多層防御にする（RLS 失効時の保険）。
      .eq('owner_id', userId)
      .maybeSingle()
    if (error) {
      throw new Error(`マップの取得に失敗しました: ${error.message}`)
    }
    if (!data) {
      return null // 他人の行は RLS で見えない＝null（→ ルートで 404）。
    }
    const row = data as unknown as MindMapRow
    return {
      id: row.id,
      title: row.title,
      nodes: row.snapshot.nodes,
      edges: row.snapshot.edges,
      settings: row.settings,
    }
  }

  async save(userId: string, input: SaveMindMapInput): Promise<MindMapSummary> {
    const snapshot = { version: 1 as const, nodes: input.nodes, edges: input.edges }
    const rootKeyword = deriveRootKeyword(input)

    if (input.id) {
      // 上書き（本人のもののみ・RLS＋owner_id 明示）。
      const { data, error } = await this.client
        .from(TABLE)
        .update({
          title: input.title,
          root_keyword: rootKeyword,
          settings: input.settings,
          snapshot,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('owner_id', userId)
        .select('id, title, updated_at')
        .maybeSingle()
      if (error) {
        throw new Error(`マップの保存に失敗しました: ${error.message}`)
      }
      // 0 行（他人の id / 不存在）は更新対象なし。500 ではなく 404 として一貫写像する。
      if (!data) {
        throw new AppError('NOT_FOUND', 'マップが見つかりません。')
      }
      return toSummary(data)
    }

    // 新規作成。owner_id を明示（RLS insert ポリシーは owner_id = auth.uid() を要求）。
    const { data, error } = await this.client
      .from(TABLE)
      .insert({
        owner_id: userId,
        title: input.title,
        root_keyword: rootKeyword,
        settings: input.settings,
        snapshot,
      })
      .select('id, title, updated_at')
      .maybeSingle()
    if (error) {
      throw new Error(`マップの作成に失敗しました: ${error.message}`)
    }
    if (!data) {
      // insert は通常行を返す。null は想定外（RLS の insert ポリシー不一致など）。
      throw new Error('マップの作成に失敗しました: 作成結果を取得できませんでした')
    }
    return toSummary(data)
  }

  async remove(userId: string, mapId: string): Promise<void> {
    const { error } = await this.client.from(TABLE).delete().eq('id', mapId).eq('owner_id', userId)
    if (error) {
      throw new Error(`マップの削除に失敗しました: ${error.message}`)
    }
  }
}

const toSummary = (row: unknown): MindMapSummary => {
  const r = row as { id: string; title: string; updated_at: string }
  return { id: r.id, title: r.title, updatedAt: r.updated_at }
}

/** ユーザー JWT を引き継いだ Supabase クライアントを生成するファクトリ（リクエストごとに使う）。 */
export interface MindMapRepositoryFactory {
  forUser(token: string): MindMapRepository
}

/** Supabase URL/anon キーから、JWT 引き継ぎクライアントを作るファクトリを構成する。 */
export const createSupabaseRepositoryFactory = (config: {
  url: string
  anonKey: string
}): MindMapRepositoryFactory => ({
  forUser: (token) =>
    new SupabaseMindMapRepository(
      createClient(config.url, config.anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    ),
})
