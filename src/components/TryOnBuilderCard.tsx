import { categoryLabels, sceneLabels, styleLabels } from '../app-constants'
import type { TryOnSelectionSlot } from '../app-utils'
import type { RecommendationLook, Scene, WardrobeItem } from '../types'

type TryOnSlotOptions = {
  top: WardrobeItem[]
  bottom: WardrobeItem[]
  dress: WardrobeItem[]
  outerwear: WardrobeItem[]
  shoes: WardrobeItem[]
}

type Props = {
  canRunPrimaryTryOnAction: boolean
  currentLook: RecommendationLook | null
  currentTryOnGenerationMessage: string
  effectiveTryOnSelection: Record<TryOnSelectionSlot, string>
  handleClearTryOnSelection: () => void
  handleFillTryOnFromCurrentLook: () => void
  handlePrimaryTryOnAction: () => void
  primaryTryOnActionLabel: string
  renderLookStage: (look: RecommendationLook, compact?: boolean, tryOnImageUrl?: string) => React.ReactNode
  renderTryOnSlotField: (
    slot: TryOnSelectionSlot,
    title: string,
    placeholder: string,
    options: WardrobeItem[],
    selectedId: string,
    disabled?: boolean,
  ) => React.ReactNode
  scene: Scene
  selectedTryOnBlockingMessage: string
  tryOnCreating: boolean
  tryOnGarmentItems: WardrobeItem[]
  tryOnPreviewImageUrl: string
  tryOnPreviewIsOutfitGeneration: boolean
  tryOnPreviewItems: WardrobeItem[]
  tryOnPreviewLook: RecommendationLook | null
  tryOnReadiness: {
    hasTryOnPhoto: boolean
    readyCount: number
  }
  tryOnSlotOptions: TryOnSlotOptions
}

export function TryOnBuilderCard({
  canRunPrimaryTryOnAction,
  currentLook,
  currentTryOnGenerationMessage,
  effectiveTryOnSelection,
  handleClearTryOnSelection,
  handleFillTryOnFromCurrentLook,
  handlePrimaryTryOnAction,
  primaryTryOnActionLabel,
  renderLookStage,
  renderTryOnSlotField,
  scene,
  selectedTryOnBlockingMessage,
  tryOnCreating,
  tryOnGarmentItems,
  tryOnPreviewImageUrl,
  tryOnPreviewIsOutfitGeneration,
  tryOnPreviewItems,
  tryOnPreviewLook,
  tryOnReadiness,
  tryOnSlotOptions,
}: Props) {
  return (
    <article className="settings-card wide-card try-on-focus-card">
      <div className="settings-card-head">
        <div>
          <h3>自己搭一套再试</h3>
          <p>左边选衣服，右边直接看整套预览。选好就点按钮，系统会自己处理。</p>
        </div>
        <div className="try-on-builder-actions">
          <button className="ghost" type="button" onClick={handleFillTryOnFromCurrentLook} disabled={!currentLook}>
            用首页推荐填入
          </button>
          <button className="ghost" type="button" onClick={handleClearTryOnSelection}>
            清空重选
          </button>
          <button
            className="secondary"
            type="button"
            onClick={handlePrimaryTryOnAction}
            disabled={!tryOnPreviewLook || !canRunPrimaryTryOnAction || tryOnCreating}
          >
            {primaryTryOnActionLabel}
          </button>
        </div>
        {currentTryOnGenerationMessage ? <div className="inline-progress-note">{currentTryOnGenerationMessage}</div> : null}
      </div>

      <div className="try-on-setup-grid">
        <div className="try-on-setup-pane">
          <strong>搭配台</strong>
          <div className="try-on-builder-grid">
            {renderTryOnSlotField('dress', '连衣裙', '不选连衣裙', tryOnSlotOptions.dress, effectiveTryOnSelection.dress)}

            {renderTryOnSlotField(
              'top',
              '上衣',
              effectiveTryOnSelection.dress ? '已被连衣裙替代' : '选择上衣',
              tryOnSlotOptions.top,
              effectiveTryOnSelection.top,
              Boolean(effectiveTryOnSelection.dress),
            )}

            {renderTryOnSlotField(
              'bottom',
              '下装',
              effectiveTryOnSelection.dress ? '已被连衣裙替代' : '选择下装',
              tryOnSlotOptions.bottom,
              effectiveTryOnSelection.bottom,
              Boolean(effectiveTryOnSelection.dress),
            )}

            {renderTryOnSlotField('outerwear', '外套', '这套先不加外套', tryOnSlotOptions.outerwear, effectiveTryOnSelection.outerwear)}
            {renderTryOnSlotField('shoes', '鞋子', '先不配鞋', tryOnSlotOptions.shoes, effectiveTryOnSelection.shoes)}
          </div>

          <div className="avatar-profile-summary">
            <span>{tryOnReadiness.hasTryOnPhoto ? '本人照已准备' : '缺少本人照'}</span>
            <span>{tryOnReadiness.readyCount} 件可试穿单品</span>
            <span>{selectedTryOnBlockingMessage}</span>
          </div>
        </div>

        <div className="try-on-setup-pane">
          <strong>当前整套预览</strong>
          {tryOnPreviewLook ? (
            <div className="try-on-look-card">
              <div className="try-on-look-stage">{renderLookStage(tryOnPreviewLook, true, tryOnPreviewImageUrl)}</div>
              <div className="try-on-look-copy">
                <div className="saved-look-topline">
                  <strong>{styleLabels[tryOnPreviewLook.style]}风</strong>
                  <span>{tryOnPreviewImageUrl ? '已有结果' : '等待生成'}</span>
                </div>
                <p>{tryOnPreviewLook.summary}</p>
                <div className="avatar-profile-summary compact-summary">
                  <span>{tryOnGarmentItems.length} 件衣物</span>
                  <span>{tryOnPreviewImageUrl ? (tryOnPreviewIsOutfitGeneration ? '命中历史效果图' : '命中历史试穿图') : '还没生成结果'}</span>
                  <span>{sceneLabels[scene]}</span>
                </div>
                <div className="try-on-selected-items">
                  {tryOnPreviewItems.map((item) => (
                    <div className="try-on-selected-pill" key={item.id}>
                      <strong>{item.name}</strong>
                      <span>{categoryLabels[item.category]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-inline">先把连衣裙选上，或者把上衣和下装配齐，这里就会马上出现整套预览。</div>
          )}
        </div>
      </div>
    </article>
  )
}
