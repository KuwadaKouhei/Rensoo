// @rensoo/shared の公開境界（barrel）。
// フロント / サーバー / LLM 検証が参照する型・スキーマ・ドメイン IF をここから公開する
//（DIRECTORY_STRUCTURE §2.5: barrel は shared の公開境界にのみ置く）。
// NodeNext のため相対 import/export は .js 拡張子を付ける。

// ドメイン: モデル
export * from './domain/mind-map/model.js'
// ドメイン: 連想（IF・エラー・整形ロジック）
export * from './domain/association/associationProvider.js'
export * from './domain/association/normalizeAssociations.js'
// ドメイン: 永続化 IF
export * from './domain/persistence/mindMapRepository.js'

// スキーマ（Zod）
export * from './schema/associationSchema.js'
export * from './schema/generationSettingsSchema.js'
export * from './schema/expansionSchema.js'
export * from './schema/llmResponseSchema.js'
export * from './schema/mapSchema.js'
