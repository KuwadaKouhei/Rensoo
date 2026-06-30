// 生成設定 UI（1ノードあたりの連想件数・DESIGN §6.1 / AC-2）。
// 値は shared の Zod（範囲 3〜10）で検証してからストアへ反映する（範囲外は無視）。
// 件数は次回生成の count に追従する（createAssociationMap が生成時に store.settings を読む）。

import { generationSettingsSchema } from '@rensoo/shared'
import { useMindMapStore } from '../../store/mindMapStore'

/** countPerNode 単体の検証スキーマ（共有スキーマの該当フィールドを再利用）。 */
const countSchema = generationSettingsSchema.shape.countPerNode

export const GenerationSettingsPanel = () => {
  const countPerNode = useMindMapStore((s) => s.settings.countPerNode)
  const updateSettings = useMindMapStore((s) => s.updateSettings)
  const isGenerating = useMindMapStore((s) => s.status === 'generating')

  const onChangeCount = (raw: string): void => {
    const parsed = countSchema.safeParse(Number(raw))
    if (parsed.success) {
      updateSettings({ countPerNode: parsed.data })
    }
    // 範囲外・非数は反映しない（入力途中の不正値を握りつぶさず単に無視）。
  }

  return (
    <div className="generation-settings">
      <label className="generation-settings__field">
        <span>連想件数</span>
        <input
          type="number"
          min={3}
          max={10}
          step={1}
          value={countPerNode}
          onChange={(e) => onChangeCount(e.target.value)}
          disabled={isGenerating}
          aria-label="1ノードあたりの連想件数（3〜10）"
        />
      </label>
    </div>
  )
}
