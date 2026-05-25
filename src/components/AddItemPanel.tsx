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
import { imagePresetLabels, intakeModeMeta, type AddIntakeMode, type ImagePreset } from '../app-utils'
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

type AddFormState = {
  name: string
  category: ClothingCategory
  colorGroup: ColorGroup
  thickness: Thickness
  style: StyleTag
  imageUrl: string
  sourceImageUrl: string
  seasonFit: SeasonFit
  fitType: FitType
  garmentLength: GarmentLength
  sleeveLength: SleeveLength
  silhouette: Silhouette
}

type BatchExtractionItem = {
  id: string
  fileName: string
  imageUrl: string
  rawImageUrl: string
  hint: string
  status: 'done' | 'error'
  errorMessage?: string
}

type Props = {
  addForm: AddFormState
  batchExtractionCompleted: number
  batchExtractionCurrentName: string
  batchExtractionItems: BatchExtractionItem[]
  batchExtractionProgress: number
  batchExtractionSelectedId: string | null
  batchExtractionTotal: number
  canQuickConfirmAdd: boolean
  currentPreviewMethod: string | undefined
  handleAddItem: (event: React.FormEvent<HTMLFormElement>) => void
  handleApplyPreset: (preset: ImagePreset) => void
  handleClearAddImage: () => void
  handleImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  imageHint: string
  imagePreparing: boolean
  imagePreset: ImagePreset
  itemSaving: boolean
  onApplySmartDraft: () => void
  onOpenAddIntake: (mode: AddIntakeMode) => void
  onPickBatchItem: (id: string) => void
  preferredAddIntake: AddIntakeMode
  previewBackdrop: 'checker' | 'dark' | 'warm'
  rawImageUrl: string
  setAddForm: React.Dispatch<React.SetStateAction<AddFormState>>
  setFeedbackToEditHint: () => void
  setPreviewBackdrop: React.Dispatch<React.SetStateAction<'checker' | 'dark' | 'warm'>>
  setSubjectCutEnabled: React.Dispatch<React.SetStateAction<boolean>>
  smartDraft: SmartDraftView | null
  subjectCutEnabled: boolean
}

export function AddItemPanel({
  addForm,
  batchExtractionCompleted,
  batchExtractionCurrentName,
  batchExtractionItems,
  batchExtractionProgress,
  batchExtractionSelectedId,
  batchExtractionTotal,
  canQuickConfirmAdd,
  currentPreviewMethod,
  handleAddItem,
  handleApplyPreset,
  handleClearAddImage,
  handleImageUpload,
  imageHint,
  imagePreparing,
  imagePreset,
  itemSaving,
  onApplySmartDraft,
  onOpenAddIntake,
  onPickBatchItem,
  preferredAddIntake,
  previewBackdrop,
  rawImageUrl,
  setAddForm,
  setFeedbackToEditHint,
  setPreviewBackdrop,
  setSubjectCutEnabled,
  smartDraft,
  subjectCutEnabled,
}: Props) {
  return (
    <section className="page form-page">
      <div className="section-head">
        <h2>新增衣物</h2>
        <p>先录入常穿的 5 到 10 件，就已经足够开始稳定推荐。</p>
      </div>

      <div className="add-intake-panel">
        <div className="section-head compact-head">
          <h3>先选录入方式</h3>
          <p>{intakeModeMeta[preferredAddIntake].note}</p>
        </div>
        <div className="add-intake-grid">
          {(Object.keys(intakeModeMeta) as AddIntakeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`add-intake-card${preferredAddIntake === mode ? ' active' : ''}`}
              onClick={() => onOpenAddIntake(mode)}
            >
              <strong>{intakeModeMeta[mode].title}</strong>
              <span>{intakeModeMeta[mode].note}</span>
            </button>
          ))}
        </div>
        <input id="add-intake-camera" hidden accept="image/*" capture="environment" type="file" onChange={handleImageUpload} />
        <input id="add-intake-gallery" hidden accept="image/*" type="file" onChange={handleImageUpload} />
        <input id="add-intake-batch" hidden accept="image/*" type="file" multiple onChange={handleImageUpload} />
      </div>

      <form className="item-form" id="add-item-form" onSubmit={handleAddItem}>
        <label className="upload-field">
          <span>衣物照片</span>
          <input accept="image/*" capture="environment" type="file" onChange={handleImageUpload} />
          <div className="preview-toolbar">
            <div className="preview-status">
              <strong>{currentPreviewMethod ?? '等待上传'}</strong>
              <span>
                {currentPreviewMethod === 'ai_cutout'
                  ? '当前应为透明底，切换深色底板更容易看边缘是否干净。'
                  : currentPreviewMethod === 'ai_studio_fallback'
                    ? '当前是 AI 整理后的灰底单品图，还没有进入透明底。'
                    : '上传后这里会显示当前走的是 AI 抠图还是兜底分支。'}
              </span>
            </div>
            <div className="preview-backdrop-toggle" role="group" aria-label="预览背景">
              {(
                [
                  ['checker', '棋盘'],
                  ['dark', '深色'],
                  ['warm', '暖底'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={previewBackdrop === value ? 'active' : ''}
                  onClick={() => setPreviewBackdrop(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </label>

        <div className={`upload-preview ${subjectCutEnabled ? 'subject-preview' : ''} preview-backdrop-${previewBackdrop}`}>
          {addForm.imageUrl ? <img src={addForm.imageUrl} alt="衣物预览" /> : <p>上传后会直接显示在首页推荐卡和衣橱列表里。</p>}
        </div>
        {subjectCutEnabled ? (
          <small className="preview-note">棋盘底纹用于检查透明背景；如果仍看到完整白底矩形，说明这张图还没有真正提取出主体。</small>
        ) : null}

        <div className="upload-helper">
          <strong>{imagePreparing ? '正在处理图片…' : '这一步怎么录更顺'}</strong>
          <p>{imageHint}</p>
        </div>

        {batchExtractionTotal > 1 ? (
          <div className="batch-progress-card">
            <div className="batch-progress-copy">
              <strong>
                {imagePreparing ? '批量提取进度' : '批量提取已完成'} {batchExtractionCompleted}/{batchExtractionTotal}
              </strong>
              <span>{imagePreparing && batchExtractionCurrentName ? `正在处理：${batchExtractionCurrentName}` : '这批结果会保留在下面，点任意一张即可切回继续录入。'}</span>
            </div>
            <div className="batch-progress-track" aria-hidden="true">
              <div className="batch-progress-fill" style={{ width: `${batchExtractionProgress}%` }} />
            </div>
          </div>
        ) : null}

        {batchExtractionItems.length > 1 ? (
          <div className="batch-card-grid">
            {batchExtractionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`batch-card${batchExtractionSelectedId === item.id ? ' active' : ''}${item.status === 'error' ? ' error' : ''}`}
                onClick={() => onPickBatchItem(item.id)}
              >
                <div className="batch-card-thumb">{item.imageUrl ? <img src={item.imageUrl} alt={item.fileName} /> : <span>{item.fileName}</span>}</div>
                <div className="batch-card-copy">
                  <strong>{item.fileName}</strong>
                  <span>{item.status === 'error' ? item.errorMessage ?? '处理失败' : item.hint}</span>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {canQuickConfirmAdd ? (
          <div className="quick-confirm-card">
            <div className="quick-confirm-copy">
              <strong>这张图已经能直接收进衣橱了</strong>
              <p>图片和主要标签都差不多齐了。赶时间的话现在就保存，之后再慢慢细调也完全来得及。</p>
            </div>
            <div className="chip-row">
              <span className="chip">{addForm.name}</span>
              <span className="chip">{categoryLabels[addForm.category]}</span>
              <span className="chip">{colorLabels[addForm.colorGroup]}</span>
              <span className="chip">{styleLabels[addForm.style]}</span>
            </div>
            <div className="action-row">
              <button className="primary" type="submit" disabled={itemSaving || imagePreparing}>
                {itemSaving ? '保存中…' : '直接加入衣橱'}
              </button>
              <button className="ghost" type="button" onClick={setFeedbackToEditHint}>
                再改细一点
              </button>
            </div>
          </div>
        ) : null}

        <div className="subject-mode-card">
          <div>
            <strong>自动分离背景与主体</strong>
            <p>默认先关着，让录入更快；只有你想把单品图收得更干净时，再打开这一档重传就行。</p>
          </div>
          <button type="button" className={subjectCutEnabled ? 'secondary' : 'ghost'} onClick={() => setSubjectCutEnabled((current) => !current)}>
            {subjectCutEnabled ? '已开启' : '已关闭'}
          </button>
        </div>

        {addForm.imageUrl ? (
          <div className="inline-image-actions">
            <button type="button" className="ghost" onClick={handleClearAddImage}>
              移除这张图片
            </button>
          </div>
        ) : null}

        {rawImageUrl ? (
          <>
            <div className="image-tools">
              <span>裁图模式</span>
              <div className="preset-row">
                {(Object.keys(imagePresetLabels) as ImagePreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={imagePreset === preset ? 'active' : ''}
                    onClick={() => handleApplyPreset(preset)}
                    disabled={imagePreparing}
                  >
                    {imagePresetLabels[preset]}
                  </button>
                ))}
              </div>
            </div>

          </>
        ) : null}

        {addForm.imageUrl ? (
          <>
            {smartDraft ? (
              <div className="smart-draft">
                <div>
                  <strong>智能建议</strong>
                  <p>{smartDraft.note}</p>
                </div>
                {smartDraft.source === 'local' ? <small className="draft-warning">这一步还只是本地粗判断，保存前最好再手动确认一下品类和长度。</small> : null}
                <div className="chip-row">
                  <span className="chip">{categoryLabels[smartDraft.category]}</span>
                  <span className="chip">{colorLabels[smartDraft.colorGroup]}</span>
                  <span className="chip">{styleLabels[smartDraft.style]}</span>
                  <span className="chip">{thicknessLabels[smartDraft.thickness]}</span>
                  <span className="chip">{seasonLabels[smartDraft.seasonFit]}</span>
                  <span className="chip">{fitTypeLabels[smartDraft.fitType]}</span>
                  <span className="chip">{garmentLengthLabels[smartDraft.garmentLength]}</span>
                  <span className="chip">{sleeveLengthLabels[smartDraft.sleeveLength]}</span>
                  <span className="chip">{silhouetteLabels[smartDraft.silhouette]}</span>
                </div>
                <button type="button" className="secondary" onClick={onApplySmartDraft}>
                  一键套用建议
                </button>
              </div>
            ) : null}

            <label>
              <span>衣物名称</span>
              <input value={addForm.name} onChange={(event) => setAddForm((current) => ({ ...current, name: event.target.value }))} />
            </label>

            <label>
              <span>品类</span>
              <select value={addForm.category} onChange={(event) => setAddForm((current) => ({ ...current, category: event.target.value as ClothingCategory }))}>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>颜色</span>
              <select value={addForm.colorGroup} onChange={(event) => setAddForm((current) => ({ ...current, colorGroup: event.target.value as ColorGroup }))}>
                {Object.entries(colorLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>厚薄</span>
              <select value={addForm.thickness} onChange={(event) => setAddForm((current) => ({ ...current, thickness: event.target.value as Thickness }))}>
                {Object.entries(thicknessLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>风格</span>
              <select value={addForm.style} onChange={(event) => setAddForm((current) => ({ ...current, style: event.target.value as StyleTag }))}>
                {Object.entries(styleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>适穿季节</span>
              <select value={addForm.seasonFit} onChange={(event) => setAddForm((current) => ({ ...current, seasonFit: event.target.value as SeasonFit }))}>
                {Object.entries(seasonLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>版型</span>
              <select value={addForm.fitType} onChange={(event) => setAddForm((current) => ({ ...current, fitType: event.target.value as FitType }))}>
                {Object.entries(fitTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>衣长</span>
              <select value={addForm.garmentLength} onChange={(event) => setAddForm((current) => ({ ...current, garmentLength: event.target.value as GarmentLength }))}>
                {Object.entries(garmentLengthLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>袖长</span>
              <select value={addForm.sleeveLength} onChange={(event) => setAddForm((current) => ({ ...current, sleeveLength: event.target.value as SleeveLength }))}>
                {Object.entries(sleeveLengthLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>廓形</span>
              <select value={addForm.silhouette} onChange={(event) => setAddForm((current) => ({ ...current, silhouette: event.target.value as Silhouette }))}>
                {Object.entries(silhouetteLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <button className="primary" type="submit" disabled={itemSaving || imagePreparing}>
              {itemSaving ? '保存中…' : '加入衣橱'}
            </button>
          </>
        ) : null}
      </form>

      <div className="mobile-tip-card">
        <h3>手机上这样录更省事</h3>
        <p>现在拍完照后不只可以直接裁图，还能一键套用颜色、风格和厚薄建议。</p>
      </div>
    </section>
  )
}
