import { categoryLabels, sceneLabels, styleLabels } from '../app-constants'
import type { RecommendationTweak } from '../engine'
import type { RecommendationLook, ReplaceCategory, Scene, WardrobeItem, WeatherProfile } from '../types'

type ReplaceableCategoryEntry = {
  category: ReplaceCategory
  options: RecommendationLook[]
}

type Props = {
  alternativeLooks: RecommendationLook[]
  activeReplaceCategory: ReplaceCategory | null
  currentLook: RecommendationLook | null
  forecastDayLabel: string
  forecastWeather: WeatherProfile
  onSelectTweak: (tweak: RecommendationTweak) => void
  onSelectReplaceCategory: (category: ReplaceCategory) => void
  recommendationTweak: RecommendationTweak
  renderItemVisual: (item: WardrobeItem) => React.ReactNode
  renderLookCard: (look: RecommendationLook, eyebrow: string, compact?: boolean, interactive?: boolean) => React.ReactNode
  renderReplacePreview: (baseLook: RecommendationLook, nextLook: RecommendationLook, category: ReplaceCategory) => React.ReactNode
  replacementOptions: RecommendationLook[]
  replaceCategory: ReplaceCategory | null
  replaceableCategories: ReplaceableCategoryEntry[]
  scene: Scene
  buildHomeSummaryHighlight: (look: RecommendationLook, weather: WeatherProfile, scene: Scene) => string
  buildEmptyReplacementCopy: (category: ReplaceCategory | null) => string
  pickToneVariant: (seed: string, variants: string[]) => string
  setRecommendationIndexByLookId: (lookId: string) => void
  setReplaceCategory: (category: ReplaceCategory | null) => void
}

export function HomeRecommendationSection({
  alternativeLooks,
  activeReplaceCategory,
  currentLook,
  forecastDayLabel,
  forecastWeather,
  onSelectTweak,
  onSelectReplaceCategory,
  recommendationTweak,
  renderItemVisual,
  renderLookCard,
  renderReplacePreview,
  replacementOptions,
  replaceCategory,
  replaceableCategories,
  scene,
  buildHomeSummaryHighlight,
  buildEmptyReplacementCopy,
  pickToneVariant,
  setRecommendationIndexByLookId,
  setReplaceCategory,
}: Props) {
  if (!currentLook) {
    return (
      <div className="empty-block">
        <h2>现在还凑不出一套像样的推荐</h2>
        <p>先录入几件常穿的上衣、下装和鞋子，系统才更容易按天气和场景帮你搭。</p>
      </div>
    )
  }

  return (
    <>
      <section className="home-summary-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">今日主推</p>
            <h2>{styleLabels[currentLook.style]}风整套推荐</h2>
          </div>
          <div className="score-pill">{currentLook.scores.total} 分</div>
        </div>

        <div className="home-summary-grid">
          <div className="home-summary-block">
            <strong>主推结论</strong>
            <p>{currentLook.summary}</p>
          </div>
          <div className="home-summary-block">
            <strong>推荐场景</strong>
            <p>
              {sceneLabels[scene]} / {forecastDayLabel}
            </p>
          </div>
          <div className="home-summary-block">
            <strong>推荐重点</strong>
            <p>{buildHomeSummaryHighlight(currentLook, forecastWeather, scene)}</p>
          </div>
        </div>

        <div className="home-direction-inline">
          <div className="home-direction-copy">
            <strong>这套想再修一下的话</strong>
            <span>直接点一个方向，我会按这个重点重新排。</span>
          </div>
          <div className="direction-chip-row">
            {([
              ['balanced', '先这样'],
              ['taller', '更显高'],
              ['cleaner', '更精神'],
              ['hide_hips', '更遮胯'],
            ] as const).map(([value, label]) => (
              <button key={value} className={recommendationTweak === value ? 'active' : ''} onClick={() => onSelectTweak(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {renderLookCard(currentLook, `${forecastDayLabel}推荐`, false, true)}

      {replaceCategory ? (
        <section className="replace-panel" id="replace-panel">
          <div className="replace-header">
            <h3>微调这一套</h3>
            <p>
              {pickToneVariant(`replace-head-${activeReplaceCategory ?? 'none'}`, [
                '不重算整套，只换掉你现在最想调整的那个位置。',
                '先别把整套推翻，只动你最在意的那一块会更快。',
                '这一轮只做小改动，尽量把整套氛围和天气适配保留下来。',
              ])}
            </p>
            <div className="replace-types">
              {replaceableCategories.map(({ category }) => (
                <button key={category} className={activeReplaceCategory === category ? 'active' : ''} onClick={() => onSelectReplaceCategory(category)}>
                  {categoryLabels[category]}
                </button>
              ))}
            </div>
          </div>

          {replacementOptions.length > 0 ? (
            <div className="replacement-option-grid">
              {replacementOptions.map((option, index) => (
                <div className="replacement-option" key={option.id}>
                  {activeReplaceCategory ? renderReplacePreview(currentLook, option, activeReplaceCategory) : null}
                  <div className="replacement-look-compact">{renderLookCard(option, `替换方案 ${index + 1}`, true)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="weather-tip">{buildEmptyReplacementCopy(activeReplaceCategory)}</p>
          )}
        </section>
      ) : null}

      {alternativeLooks.length > 0 ? (
        <section className="decision-queue">
          <div className="section-head compact-head">
            <h3>备选方案</h3>
          </div>
          <div className="decision-queue-grid">
            {alternativeLooks.map((look) => (
              <button
                key={look.id}
                className="decision-queue-card"
                onClick={() => {
                  setRecommendationIndexByLookId(look.id)
                  setReplaceCategory(null)
                }}
              >
                <div className="decision-queue-top">
                  <strong>{styleLabels[look.style]}风</strong>
                  <span>{look.scores.total} 分</span>
                </div>
                <div className="decision-queue-items">
                  {look.items.slice(0, 3).map(({ item }) => (
                    <div key={item.id} className="decision-queue-thumb">
                      {renderItemVisual(item)}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
