import {
  categoryLabels,
  colorLabels,
  fitTypeLabels,
  garmentLengthLabels,
  seasonLabels,
  silhouetteLabels,
  sleeveLengthLabels,
  styleLabels,
  thicknessLabels,
} from '../app-constants'
import type { ImagePreset } from '../app-utils'
import { imagePresetLabels } from '../app-utils'
import type {
  ClothingCategory,
  ColorGroup,
  FitType,
  GarmentLength,
  SeasonFit,
  Silhouette,
  SleeveLength,
  StyleTag,
  Thickness,
  WardrobeItem,
} from '../types'

type SmartDraftView = {
  category: ClothingCategory
  colorGroup: ColorGroup
  thickness: Thickness
  style: StyleTag
  seasonFit: SeasonFit
  fitType: FitType
  garmentLength: GarmentLength
  sleeveLength: SleeveLength
  silhouette: Silhouette
  note: string
  source: 'ai' | 'local'
}

type WardrobeEditState = {
  id: string
  name: string
  category: ClothingCategory
  colorGroup: ColorGroup
  thickness: Thickness
  style: StyleTag
  seasonFit: SeasonFit
  fitType: FitType
  garmentLength: GarmentLength
  sleeveLength: SleeveLength
  silhouette: Silhouette
  imageUrl: string
  sourceImageUrl: string
}

type Props = {
  applyWardrobeEditSmartDraft: () => void
  editImageHint: string
  editImagePreparing: boolean
  editImagePreset: ImagePreset
  editRawImageUrl: string
  editSmartDraft: SmartDraftView | null
  editingWardrobeItem: WardrobeItem
  handleApplyWardrobeEditPreset: (preset: ImagePreset) => void
  handleRemoveWardrobeEditImage: () => void
  handleSaveWardrobeEdit: () => void
  handleWardrobeEditImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onCancel: () => void
  setWardrobeEdit: React.Dispatch<React.SetStateAction<WardrobeEditState | null>>
  subjectCutEnabled: boolean
  wardrobeEdit: WardrobeEditState
  wardrobeSaving: boolean
}

export function WardrobeEditorPanel({
  applyWardrobeEditSmartDraft,
  editImageHint,
  editImagePreparing,
  editImagePreset,
  editRawImageUrl,
  editSmartDraft,
  editingWardrobeItem,
  handleApplyWardrobeEditPreset,
  handleRemoveWardrobeEditImage,
  handleSaveWardrobeEdit,
  handleWardrobeEditImageUpload,
  onCancel,
  setWardrobeEdit,
  subjectCutEnabled,
  wardrobeEdit,
  wardrobeSaving,
}: Props) {
  return (
    <article className="settings-card wardrobe-editor">
      <div className="section-head">
        <h3>编辑这件衣服</h3>
        <p>改完会直接影响后面的推荐和替换结果。</p>
      </div>

      <div className="wardrobe-editor-grid">
        <div className="wardrobe-editor-visual">
          <div className={`upload-preview compact-preview ${subjectCutEnabled ? 'subject-preview' : ''}`}>
            {wardrobeEdit.imageUrl ? (
              <img src={wardrobeEdit.imageUrl} alt={wardrobeEdit.name} />
            ) : editingWardrobeItem.imageUrl ? (
              <img src={editingWardrobeItem.imageUrl} alt={editingWardrobeItem.name} />
            ) : (
              <p>换一张更干净的单品图，后面的推荐页会更统一。</p>
            )}
          </div>
          {subjectCutEnabled ? (
            <small className="preview-note">棋盘底纹用于检查透明背景；如果仍看到完整白底矩形，说明这张图还没有真正提取出主体。</small>
          ) : null}

          <label className="upload-field inline-upload-field">
            <span>重新上传衣物图</span>
            <input accept="image/*" capture="environment" type="file" onChange={handleWardrobeEditImageUpload} />
          </label>

          <div className="inline-image-actions">
            <button type="button" className="ghost" onClick={handleRemoveWardrobeEditImage}>
              移除当前图片
            </button>
          </div>

          <div className="upload-helper compact-helper">
            <strong>{editImagePreparing ? '正在处理新图片…' : '编辑图片提示'}</strong>
            <p>{editImageHint}</p>
          </div>

          {editRawImageUrl ? (
            <div className="image-tools compact-image-tools">
              <span>换图裁剪模式</span>
              <div className="preset-row">
                {(Object.keys(imagePresetLabels) as ImagePreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={editImagePreset === preset ? 'active' : ''}
                    onClick={() => handleApplyWardrobeEditPreset(preset)}
                    disabled={editImagePreparing}
                  >
                    {imagePresetLabels[preset]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {editSmartDraft ? (
            <div className="smart-draft">
              <div>
                <strong>换图后的识别建议</strong>
                <p>{editSmartDraft.note}</p>
              </div>
              {editSmartDraft.source === 'local' ? <small className="draft-warning">这一步还只是本地粗判断，保存前最好再手动确认一下品类和长度。</small> : null}
              <div className="chip-row">
                <span className="chip">{categoryLabels[editSmartDraft.category]}</span>
                <span className="chip">{colorLabels[editSmartDraft.colorGroup]}</span>
                <span className="chip">{styleLabels[editSmartDraft.style]}</span>
                <span className="chip">{thicknessLabels[editSmartDraft.thickness]}</span>
                <span className="chip">{seasonLabels[editSmartDraft.seasonFit]}</span>
                <span className="chip">{fitTypeLabels[editSmartDraft.fitType]}</span>
                <span className="chip">{garmentLengthLabels[editSmartDraft.garmentLength]}</span>
                <span className="chip">{sleeveLengthLabels[editSmartDraft.sleeveLength]}</span>
                <span className="chip">{silhouetteLabels[editSmartDraft.silhouette]}</span>
              </div>
              <button type="button" className="secondary" onClick={applyWardrobeEditSmartDraft}>
                一键套用建议
              </button>
            </div>
          ) : null}
        </div>

        <div className="item-form compact-form">
          <label hidden>
            <span>衣物名称</span>
            <input value={wardrobeEdit.name} onChange={(event) => setWardrobeEdit((current) => (current ? { ...current, name: event.target.value } : current))} />
          </label>

          <label>
            <span>品类</span>
            <select
              hidden
              value={wardrobeEdit.category}
              onChange={(event) => setWardrobeEdit((current) => (current ? { ...current, category: event.target.value as ClothingCategory } : current))}
            >
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>颜色</span>
            <select
              value={wardrobeEdit.colorGroup}
              onChange={(event) => setWardrobeEdit((current) => (current ? { ...current, colorGroup: event.target.value as ColorGroup } : current))}
            >
              {Object.entries(colorLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>厚薄</span>
            <select
              value={wardrobeEdit.thickness}
              onChange={(event) => setWardrobeEdit((current) => (current ? { ...current, thickness: event.target.value as Thickness } : current))}
            >
              {Object.entries(thicknessLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>风格</span>
            <select
              value={wardrobeEdit.style}
              onChange={(event) => setWardrobeEdit((current) => (current ? { ...current, style: event.target.value as StyleTag } : current))}
            >
              {Object.entries(styleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>适穿季节</span>
            <select
              value={wardrobeEdit.seasonFit}
              onChange={(event) => setWardrobeEdit((current) => (current ? { ...current, seasonFit: event.target.value as SeasonFit } : current))}
            >
              {Object.entries(seasonLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>版型</span>
            <select
              value={wardrobeEdit.fitType}
              onChange={(event) => setWardrobeEdit((current) => (current ? { ...current, fitType: event.target.value as FitType } : current))}
            >
              {Object.entries(fitTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>衣长</span>
            <select
              value={wardrobeEdit.garmentLength}
              onChange={(event) => setWardrobeEdit((current) => (current ? { ...current, garmentLength: event.target.value as GarmentLength } : current))}
            >
              {Object.entries(garmentLengthLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>袖长</span>
            <select
              value={wardrobeEdit.sleeveLength}
              onChange={(event) => setWardrobeEdit((current) => (current ? { ...current, sleeveLength: event.target.value as SleeveLength } : current))}
            >
              {Object.entries(sleeveLengthLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>廓形</span>
            <select
              value={wardrobeEdit.silhouette}
              onChange={(event) => setWardrobeEdit((current) => (current ? { ...current, silhouette: event.target.value as Silhouette } : current))}
            >
              {Object.entries(silhouetteLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="action-row">
        <button className="primary" onClick={handleSaveWardrobeEdit} disabled={wardrobeSaving}>
          {wardrobeSaving ? '保存中…' : '保存修改'}
        </button>
        <button className="ghost" onClick={onCancel}>
          先不改了
        </button>
      </div>
    </article>
  )
}
