import { categoryLabels, colorLabels, fitTypeLabels, seasonLabels, styleLabels, thicknessLabels } from '../app-constants'
import type { WardrobeItem } from '../types'

type Props = {
  focusedWardrobeItem: WardrobeItem
  isEditingCurrentItem: boolean
  onClose: () => void
  onDelete: (id: string) => void
  onEdit: (item: WardrobeItem) => void
  renderItemVisual: (item: WardrobeItem) => React.ReactNode
}

export function WardrobeDetailCard({
  focusedWardrobeItem,
  isEditingCurrentItem,
  onClose,
  onDelete,
  onEdit,
  renderItemVisual,
}: Props) {
  return (
    <article className="settings-card wardrobe-detail-card">
      <div className="section-head">
        <div>
          <h3>{focusedWardrobeItem.name}</h3>
          <p>先确认这件衣服的状态和标签，再决定要不要继续修改。</p>
        </div>
        <button className="ghost" onClick={onClose}>
          收起详情
        </button>
      </div>

      <div className="wardrobe-detail-grid">
        <div>{renderItemVisual(focusedWardrobeItem)}</div>

        <div className="wardrobe-detail-copy">
          <div className="chip-row">
            <span className="chip">{categoryLabels[focusedWardrobeItem.category]}</span>
            <span className="chip">{styleLabels[focusedWardrobeItem.style]}</span>
            <span className="chip">{thicknessLabels[focusedWardrobeItem.thickness]}</span>
            <span className="chip">{colorLabels[focusedWardrobeItem.colorGroup]}</span>
            <span className="chip">{seasonLabels[focusedWardrobeItem.seasonFit]}</span>
            <span className="chip">{fitTypeLabels[focusedWardrobeItem.fitType]}</span>
          </div>

          <div className="wardrobe-detail-stats">
            <div className="metric-card">
              <strong>{focusedWardrobeItem.wearCount}</strong>
              <span>累计穿着</span>
            </div>
            <div className="metric-card">
              <strong>{focusedWardrobeItem.lastWornAt ?? '还没记录'}</strong>
              <span>最近一次穿着</span>
            </div>
            <div className="metric-card">
              <strong>{focusedWardrobeItem.preferenceScore}</strong>
              <span>当前偏好分</span>
            </div>
          </div>

          <div className="action-row">
            <button className="primary" onClick={() => onEdit(focusedWardrobeItem)}>
              {isEditingCurrentItem ? '继续编辑这件' : '编辑这件'}
            </button>
            <button className="ghost danger" onClick={() => onDelete(focusedWardrobeItem.id)}>
              删除这件
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
