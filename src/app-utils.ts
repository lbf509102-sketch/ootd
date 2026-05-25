import { buildForecastTipCopy, buildHomeSummaryHighlightCopy, buildSavedSectionDescriptionCopy } from './copy'
import type {
  ClothingCategory,
  ColorGroup,
  FitType,
  GarmentLength,
  RecommendationLook,
  SavedLook,
  Scene,
  Silhouette,
  SleeveLength,
  StyleTag,
  TryOnSession,
  WardrobeItem,
  WeatherProfile,
} from './types'

export type ImagePreset = 'original' | 'card' | 'studio' | 'square'
export type SavedSection = 'history' | 'favorite'
export type SavedStyleFilter = 'all' | StyleTag
export type WardrobeSort = 'smart' | 'recent' | 'most_worn' | 'name'
export type WardrobeQuickFilter = 'all' | 'recently_worn' | 'recently_added'
export type WardrobeFiltersState = {
  category: 'all' | ClothingCategory
  colorGroup: 'all' | ColorGroup
  style: 'all' | StyleTag
  status: 'all'
  sort: WardrobeSort
}
export type ForecastDay = 'today' | 'tomorrow'
export type AddIntakeMode = 'camera' | 'gallery' | 'batch'
export type TryOnSelectionSlot = 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes'
export type TryOnSelectionState = Record<TryOnSelectionSlot, string>

export const imagePresetLabels = {
  original: '原图',
  card: '衣橱卡片',
  studio: '净底展示',
  square: '正方裁切',
} as const

export const wardrobeSortLabels: Record<WardrobeSort, string> = {
  smart: '默认优先',
  recent: '最近穿过',
  most_worn: '最常穿',
  name: '按名称',
}

export const wardrobeQuickFilterLabels: Record<WardrobeQuickFilter, string> = {
  all: '全部',
  recently_worn: '最近穿过',
  recently_added: '最近新增',
}

export const forecastDayLabels: Record<ForecastDay, string> = {
  today: '今天',
  tomorrow: '明天',
}

export const intakeModeMeta: Record<
  AddIntakeMode,
  {
    title: string
    note: string
  }
> = {
  camera: {
    title: '拍一张',
    note: '适合马上对着单品拍正面图，系统会自动提取主体。',
  },
  gallery: {
    title: '从相册选',
    note: '适合单张精修图，上传后会自动识别标签。',
  },
  batch: {
    title: '批量导入',
    note: '适合一次整理多件衣服，会逐批处理并显示进度。',
  },
}

export function getWeatherLabel(weatherType: WeatherProfile['weatherType']) {
  if (weatherType === 'rainy') return '有雨'
  if (weatherType === 'sunny') return '晴朗'
  if (weatherType === 'windy') return '风大'
  return '多云'
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function buildForecastWeather(base: WeatherProfile, day: ForecastDay): WeatherProfile {
  const dayOffset = day === 'today' ? 0 : 1
  const dayTempShift = day === 'today' ? 0 : 1
  const nextTemperature = base.temperature + dayTempShift
  const nextFeelsLike = base.feelsLike + dayTempShift
  const nextRainProbability = clampNumber(base.rainProbability + dayOffset * 6, 0, 100)
  const nextHumidity = clampNumber(base.humidity + (day === 'tomorrow' ? 2 : 0), 20, 98)
  const nextTempGap = clampNumber(base.tempGap + (day === 'tomorrow' ? 1 : 0), 2, 14)
  const weatherType =
    nextRainProbability >= 55 ? 'rainy' : nextFeelsLike >= 31 ? 'sunny' : nextTempGap >= 9 ? 'windy' : base.weatherType
  const windLevel = nextTempGap >= 9 ? 'high' : nextTempGap >= 6 ? 'medium' : base.windLevel

  return {
    ...base,
    temperature: nextTemperature,
    feelsLike: nextFeelsLike,
    rainProbability: nextRainProbability,
    humidity: nextHumidity,
    tempGap: nextTempGap,
    weatherType,
    windLevel,
  }
}

export function buildForecastTip(weather: WeatherProfile, day: ForecastDay) {
  const dayLabel = forecastDayLabels[day]
  const seed = `${day}-${weather.weatherType}-${weather.feelsLike}-${weather.tempGap}-${weather.rainProbability}-${weather.windLevel}`
  return buildForecastTipCopy(weather, dayLabel, seed)
}

export function formatSavedDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚保存'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function toSortableTime(value?: string) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

export function buildLocalHistoryEntry(look: RecommendationLook): SavedLook {
  return {
    id: `history-local-${crypto.randomUUID()}`,
    kind: 'history',
    look,
    createdAt: new Date().toISOString(),
  }
}

export function buildHomeSummaryHighlight(look: RecommendationLook, weather: WeatherProfile, scene: Scene) {
  return buildHomeSummaryHighlightCopy(look, weather, scene)
}

export function buildSavedSectionDescription(section: SavedSection) {
  return buildSavedSectionDescriptionCopy(section)
}

export function getTryOnStatusLabel(status: TryOnSession['status']) {
  if (status === 'completed') return '已完成'
  if (status === 'processing') return '生成中'
  if (status === 'failed') return '失败'
  return '素材已就绪'
}

export function getTryOnProviderLabel(provider?: TryOnSession['provider'] | null) {
  if (provider === 'wan') return '效果图'
  if (provider === 'aliyun') return '效果图'
  if (provider === 'webhook') return '效果图'
  if (provider === 'mock') return '预览图'
  return '待生成'
}

export function suggestColorGroupFromRgb(red: number, green: number, blue: number): ColorGroup {
  const max = Math.max(red, green, blue)
  const diff = max - Math.min(red, green, blue)

  if (max < 90 || diff < 24) return 'black_white_gray'
  if (blue > red + 12 && blue > green - 4) return blue > 150 ? 'blue' : 'denim'
  if (red > 170 && green > 120) return 'khaki_brown'
  if (red > 150 && diff > 45) return 'accent'
  return 'khaki_brown'
}

export function inferVisualMeta(category: ClothingCategory, fitType: FitType) {
  const silhouette: Silhouette =
    fitType === 'slim' ? 'fitted' : fitType === 'relaxed' ? 'relaxed' : category === 'dress' ? 'a_line' : 'straight'

  if (category === 'top') {
    return { garmentLength: 'regular' as GarmentLength, sleeveLength: 'short' as SleeveLength, silhouette }
  }

  if (category === 'outerwear') {
    return { garmentLength: 'long' as GarmentLength, sleeveLength: 'long' as SleeveLength, silhouette }
  }

  if (category === 'dress') {
    return {
      garmentLength: 'midi' as GarmentLength,
      sleeveLength: 'short' as SleeveLength,
      silhouette: fitType === 'slim' ? ('fitted' as Silhouette) : ('a_line' as Silhouette),
    }
  }

  if (category === 'bottom') {
    return { garmentLength: 'regular' as GarmentLength, sleeveLength: 'na' as SleeveLength, silhouette }
  }

  return {
    garmentLength: 'short' as GarmentLength,
    sleeveLength: 'na' as SleeveLength,
    silhouette: 'straight' as Silhouette,
  }
}

export function getLookItemMap(look: RecommendationLook) {
  return look.items.reduce<Partial<Record<ClothingCategory, WardrobeItem>>>((map, entry) => {
    map[entry.item.category] = entry.item
    return map
  }, {})
}
