import { categoryLabels } from '../app-constants'
import { formatSavedDate, getTryOnProviderLabel, getTryOnStatusLabel } from '../app-utils'
import type { TryOnSession, WardrobeItem } from '../types'

type Props = {
  recentTryOnSessions: TryOnSession[]
  tryOnSessionsCount: number
  tryOnPreviewingId: string
  wardrobeItemMap: Map<string, WardrobeItem>
  onOpenPreview: (entry: TryOnSession) => void
  onRegenerate: (id: string) => void
}

export function TryOnResultsSection({
  recentTryOnSessions,
  tryOnSessionsCount,
  tryOnPreviewingId,
  wardrobeItemMap,
  onOpenPreview,
  onRegenerate,
}: Props) {
  return (
    <article className="settings-card wide-card">
      <div className="settings-card-head">
        <div>
          <h3>最近试穿结果</h3>
          <p>这里只留最近的结果，方便你快速回看，不再堆一整页流程说明。</p>
        </div>
        <span className={`readiness-pill${tryOnSessionsCount > 0 ? ' ready' : ''}`}>{tryOnSessionsCount} 条任务</span>
      </div>

      <div className="try-on-session-list slim">
        {recentTryOnSessions.map((entry) => {
          const garment = wardrobeItemMap.get(entry.garmentItemId)
          const isLookSession = Boolean(entry.lookKey)
          const title = isLookSession ? '这套效果图' : garment?.name ?? '效果图记录'
          const metaLabel = isLookSession ? '当前这套' : garment ? categoryLabels[garment.category] : '效果图'

          return (
            <article className="try-on-session-card simple" key={entry.id}>
              <div className="saved-look-topline">
                <strong>{title}</strong>
                <span>{formatSavedDate(entry.createdAt)}</span>
              </div>
              <div className="avatar-profile-summary compact-summary">
                <span>{getTryOnStatusLabel(entry.status)}</span>
                <span>{getTryOnProviderLabel(entry.provider)}</span>
                <span>{metaLabel}</span>
              </div>
              {entry.resultImageUrl ? (
                <div className="try-on-result-preview">
                  <img src={entry.resultImageUrl} alt={`${title} 预览图`} />
                </div>
              ) : (
                <div className="empty-inline">这条结果还在处理中，稍后回来看看就行。</div>
              )}
              <div className="try-on-session-actions">
                {entry.resultImageUrl ? (
                  <button className="ghost" type="button" onClick={() => onOpenPreview(entry)}>
                    查看大图
                  </button>
                ) : null}
                <button
                  className="secondary"
                  type="button"
                  onClick={() => onRegenerate(entry.id)}
                  disabled={tryOnPreviewingId === entry.id}
                >
                  {tryOnPreviewingId === entry.id ? '生成中…' : entry.resultImageUrl ? '重新生成' : '继续生成'}
                </button>
              </div>
            </article>
          )
        })}
        {recentTryOnSessions.length === 0 ? (
          <div className="empty-block">
            <h2>{tryOnSessionsCount === 0 ? '还没有试穿结果' : '暂时还没有可展示的结果'}</h2>
            <p>
              {tryOnSessionsCount === 0
                ? '先把当前推荐整套生成一次，这里就会开始出现结果。'
                : '现在没有更近的记录，回首页换一套再生成也可以。'}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  )
}
