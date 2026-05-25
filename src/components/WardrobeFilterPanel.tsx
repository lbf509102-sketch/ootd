import { categoryLabels, colorLabels, styleLabels } from '../app-constants'
import { type WardrobeFiltersState, type WardrobeSort, wardrobeSortLabels } from '../app-utils'

type Props = {
  filters: WardrobeFiltersState
  hasActiveWardrobeFilters: boolean
  setFilters: React.Dispatch<React.SetStateAction<WardrobeFiltersState>>
}

export function WardrobeFilterPanel({ filters, hasActiveWardrobeFilters, setFilters }: Props) {
  return (
    <div className="filter-panel">
      <div className="filter-group">
        <span>按品类看</span>
        <div className="chip-filter-row">
          <button
            className={filters.category === 'all' ? 'active' : ''}
            onClick={() => setFilters((current) => ({ ...current, category: 'all' }))}
          >
            全部
          </button>
          {Object.entries(categoryLabels).map(([value, label]) => (
            <button
              key={value}
              className={filters.category === value ? 'active' : ''}
              onClick={() => setFilters((current) => ({ ...current, category: value as WardrobeFiltersState['category'] }))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <span>按风格看</span>
        <div className="chip-filter-row">
          <button
            className={filters.style === 'all' ? 'active' : ''}
            onClick={() => setFilters((current) => ({ ...current, style: 'all' }))}
          >
            全部
          </button>
          {Object.entries(styleLabels).map(([value, label]) => (
            <button
              key={value}
              className={filters.style === value ? 'active' : ''}
              onClick={() => setFilters((current) => ({ ...current, style: value as WardrobeFiltersState['style'] }))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <span>按颜色看</span>
        <div className="chip-filter-row">
          <button
            className={filters.colorGroup === 'all' ? 'active' : ''}
            onClick={() => setFilters((current) => ({ ...current, colorGroup: 'all' }))}
          >
            全部
          </button>
          {Object.entries(colorLabels).map(([value, label]) => (
            <button
              key={value}
              className={filters.colorGroup === value ? 'active' : ''}
              onClick={() => setFilters((current) => ({ ...current, colorGroup: value as WardrobeFiltersState['colorGroup'] }))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row">
        <select
          value={filters.sort}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              sort: event.target.value as WardrobeSort,
            }))
          }
        >
          {Object.entries(wardrobeSortLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {hasActiveWardrobeFilters ? (
          <button
            type="button"
            className="ghost"
            onClick={() =>
              setFilters((current) => ({
                ...current,
                category: 'all',
                colorGroup: 'all',
                style: 'all',
              }))
            }
          >
            清空筛选
          </button>
        ) : null}
      </div>
    </div>
  )
}
