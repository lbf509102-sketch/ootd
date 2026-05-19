import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import './App.css'
import {
  createWardrobeItem,
  createTryOnSession,
  deleteFavoriteLook,
  deleteWardrobeItem,
  analyzeGarmentImage,
  fetchBootstrap,
  saveAvatarProfile,
  fetchSession,
  fetchWeather,
  generateTryOnPreview,
  logoutSession,
  recordLookWear,
  requestLoginCode,
  saveFavoriteLook,
  savePreferences,
  saveSelectedCity,
  setAuthToken,
  updateWardrobeItem,
  uploadAndAnalyzeGarment,
  uploadWardrobeImage,
  verifyLoginCode,
} from './api'
import { cityOptions, initialAvatarProfile, initialPreferences, initialWardrobe } from './data'
import { generateRecommendations, replaceLookItem } from './engine'
import type {
  AvatarProfile,
  BodyShape,
  ClothingCategory,
  ColorGroup,
  ComfortPriority,
  FitType,
  GarmentLength,
  GenderPresentation,
  HipType,
  LegLengthType,
  RecommendationLook,
  ReplaceCategory,
  SavedLook,
  Scene,
  SeasonFit,
  ShoulderType,
  Silhouette,
  StyleTag,
  SleeveLength,
  TabId,
  Thickness,
  TryOnSession,
  UserPreferences,
  UserSession,
  WaistType,
  WardrobeItem,
  WeatherProfile,
} from './types'

const sessionStorageKey = 'smart-closet-session-token'
const initialSessionToken =
  typeof window !== 'undefined' ? window.localStorage.getItem(sessionStorageKey) ?? '' : ''

const tabLabels: Record<TabId, string> = {
  home: '首页',
  wardrobe: '衣橱',
  add: '录入',
  tryon: '试穿',
  profile: '我的',
}

const sceneLabels: Record<Scene, string> = {
  commute: '通勤',
  daily: '日常',
  date: '约会',
  formal: '正式',
}

const styleLabels: Record<StyleTag, string> = {
  commute: '通勤',
  casual: '休闲',
  refined: '精致',
}

const categoryLabels: Record<ClothingCategory, string> = {
  top: '上衣',
  bottom: '下装',
  outerwear: '外套',
  shoes: '鞋子',
  dress: '连衣裙',
  accessory: '配饰',
}

const colorLabels: Record<ColorGroup, string> = {
  black_white_gray: '黑白灰',
  blue: '蓝色',
  khaki_brown: '卡其棕',
  denim: '牛仔',
  accent: '亮色',
}

const thicknessLabels: Record<Thickness, string> = {
  light: '轻薄',
  regular: '常规',
  warm: '保暖',
}

const seasonLabels: Record<SeasonFit, string> = {
  summer: '夏季',
  spring_autumn: '春秋',
  winter: '冬季',
  all_season: '四季',
}

const fitTypeLabels: Record<FitType, string> = {
  slim: '修身',
  regular: '常规',
  relaxed: '宽松',
}

const garmentLengthLabels: Record<GarmentLength, string> = {
  short: '短款',
  regular: '常规',
  long: '长款',
  midi: '中长',
  maxi: '超长',
}

const sleeveLengthLabels: Record<SleeveLength, string> = {
  sleeveless: '无袖',
  short: '短袖',
  three_quarter: '七分袖',
  long: '长袖',
  na: '不适用',
}

const silhouetteLabels: Record<Silhouette, string> = {
  fitted: '贴身',
  straight: '直筒',
  relaxed: '宽松',
  a_line: 'A 字',
}

const wardrobeSortLabels: Record<WardrobeSort, string> = {
  smart: '默认优先',
  recent: '最近穿过',
  most_worn: '最常穿',
  name: '按名称',
}

const wardrobeQuickFilterLabels: Record<WardrobeQuickFilter, string> = {
  all: '全部',
  recently_worn: '最近穿过',
  recently_added: '最近新增',
}

const forecastDayLabels: Record<ForecastDay, string> = {
  today: '今天',
  tomorrow: '明天',
  day_after: '后天',
}

const dayPartLabels: Record<DayPart, string> = {
  morning: '早晨',
  daytime: '白天',
  evening: '晚上',
}

const intakeModeMeta: Record<
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
    note: '适合一次整理多件衣服，会逐张处理并显示进度。',
  },
}

const comfortOptions: Record<ComfortPriority, string> = {
  warmth_first: '保暖优先',
  lightness_first: '轻便优先',
  slimming_first: '显瘦优先',
  versatile_first: '百搭优先',
}

const genderPresentationLabels: Record<GenderPresentation, string> = {
  feminine: '偏女性化',
  masculine: '偏男性化',
  neutral: '中性',
}

const bodyShapeLabels: Record<BodyShape, string> = {
  balanced: '匀称',
  pear: '梨形',
  apple: '苹果型',
  rectangle: 'H 型',
  inverted_triangle: '倒三角',
  hourglass: '沙漏型',
}

const shoulderTypeLabels: Record<ShoulderType, string> = {
  narrow: '偏窄',
  regular: '常规',
  broad: '偏宽',
}

const waistTypeLabels: Record<WaistType, string> = {
  defined: '明显',
  regular: '常规',
  soft: '偏柔和',
}

const hipTypeLabels: Record<HipType, string> = {
  narrow: '偏窄',
  regular: '常规',
  curvy: '偏丰满',
}

const legLengthLabels: Record<LegLengthType, string> = {
  shorter: '偏短',
  regular: '常规',
  longer: '偏长',
}

const tryOnStatusFilterLabels: Record<TryOnStatusFilter, string> = {
  all: '全部',
  draft_ready: '待生成',
  processing: '生成中',
  completed: '已完成',
  failed: '失败',
}

const imagePresetLabels = {
  original: '原图',
  card: '衣物卡片',
  studio: '净色卡片',
  square: '正方形',
} as const

type ImagePreset = keyof typeof imagePresetLabels
type SavedSection = 'history' | 'favorite'
type SavedStyleFilter = 'all' | StyleTag
type TryOnStatusFilter = 'all' | TryOnSession['status']
type WardrobeSort = 'smart' | 'recent' | 'most_worn' | 'name'
type WardrobeQuickFilter = 'all' | 'recently_worn' | 'recently_added'
type ForecastDay = 'today' | 'tomorrow' | 'day_after'
type DayPart = 'morning' | 'daytime' | 'evening'
type AddIntakeMode = 'camera' | 'gallery' | 'batch'

type AddFormState = {
  name: string
  category: ClothingCategory
  colorGroup: ColorGroup
  thickness: Thickness
  style: StyleTag
  imageUrl: string
  seasonFit: SeasonFit
  fitType: FitType
  garmentLength: GarmentLength
  sleeveLength: SleeveLength
  silhouette: Silhouette
}

type LoginFormState = {
  phone: string
  code: string
}

type SmartDraft = {
  category: ClothingCategory
  colorGroup: ColorGroup
  thickness: Thickness
  style: StyleTag
  seasonFit: SeasonFit
  fitType: FitType
  garmentLength: GarmentLength
  sleeveLength: SleeveLength
  silhouette: Silhouette
  name: string
  note: string
  source: 'ai' | 'local'
  provider?: string
  confidence?: number
}

type VisionDraftPayload = {
  provider: string
  category: ClothingCategory
  colorGroup: ColorGroup
  thickness: Thickness
  style: StyleTag
  seasonFit: SeasonFit
  fitType: FitType
  garmentLength: GarmentLength
  sleeveLength: SleeveLength
  silhouette: Silhouette
  name: string
  note: string
  confidence: number
}

type GarmentAnalyzeResult = Awaited<ReturnType<typeof uploadAndAnalyzeGarment>>

type BatchExtractionItem = {
  id: string
  fileName: string
  rawImageUrl: string
  imageUrl: string
  draft: SmartDraft | null
  visionDraft: VisionDraftPayload | null
  extracted: boolean
  componentCount: number
  method?: 'ai_cutout' | 'local_cutout' | 'ai_studio_fallback' | 'fallback_original'
  needsConfirmation: boolean
  hint: string
  formValues: AddFormState
  status: 'done' | 'error'
  errorMessage?: string
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
}

const addFormDefaults: AddFormState = {
  name: '',
  category: 'top',
  colorGroup: 'black_white_gray',
  thickness: 'regular',
  style: 'commute',
  imageUrl: '',
  seasonFit: 'spring_autumn',
  fitType: 'regular',
  garmentLength: 'regular',
  sleeveLength: 'short',
  silhouette: 'straight',
}

const loginFormDefaults: LoginFormState = {
  phone: '',
  code: '',
}

function getWeatherLabel(weatherType: WeatherProfile['weatherType']) {
  if (weatherType === 'rainy') return '有雨'
  if (weatherType === 'sunny') return '晴朗'
  if (weatherType === 'windy') return '风大'
  return '多云'
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function buildForecastWeather(base: WeatherProfile, day: ForecastDay, dayPart: DayPart): WeatherProfile {
  const dayOffset = day === 'today' ? 0 : day === 'tomorrow' ? 1 : 2
  const partTempShift = dayPart === 'morning' ? -3 : dayPart === 'evening' ? -1 : 2
  const partRainShift = dayPart === 'evening' ? 8 : dayPart === 'morning' ? 3 : 0
  const dayTempShift = day === 'today' ? 0 : day === 'tomorrow' ? 1 : -1
  const nextTemperature = base.temperature + dayTempShift + partTempShift
  const nextFeelsLike = base.feelsLike + dayTempShift + partTempShift
  const nextRainProbability = clampNumber(base.rainProbability + dayOffset * 6 + partRainShift, 0, 100)
  const nextHumidity = clampNumber(base.humidity + (dayPart === 'morning' ? 6 : dayPart === 'daytime' ? -4 : 3), 20, 98)
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

function buildForecastTip(weather: WeatherProfile, day: ForecastDay, dayPart: DayPart) {
  const dayLabel = forecastDayLabels[day]
  const partLabel = dayPartLabels[dayPart]

  if (weather.rainProbability >= 55) {
    return `${dayLabel}${partLabel}降雨概率偏高，鞋子和下装尽量选更耐折腾的。`
  }

  if (weather.feelsLike >= 29) {
    return `${dayLabel}${partLabel}偏热，优先轻薄透气，尽量减少不必要叠穿。`
  }

  if (weather.tempGap >= 8 || weather.windLevel === 'high') {
    return `${dayLabel}${partLabel}温差和风感更明显，带一件外套会更从容。`
  }

  return `${dayLabel}${partLabel}体感比较稳定，可以优先挑一套省心好穿的组合。`
}

function formatSavedDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚保存'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function toSortableTime(value?: string) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function buildLocalHistoryEntry(look: RecommendationLook): SavedLook {
  return {
    id: `history-local-${crypto.randomUUID()}`,
    kind: 'history',
    look,
    createdAt: new Date().toISOString(),
  }
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('图片读取失败'))
    }
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

async function dataUrlToImageElement(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败'))
    image.src = dataUrl
  })
}

async function optimizeImageForMobile(file: File) {
  const rawDataUrl = await readFileAsDataUrl(file)

  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return { dataUrl: rawDataUrl, note: '已保留原图预览。' }
  }

  const bitmap = await createImageBitmap(file)
  const maxSize = 1600
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
  const targetHeight = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return { dataUrl: rawDataUrl, note: '已保留原图预览。' }
  }

  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
  bitmap.close()

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.86),
    note:
      scale < 1
        ? `已压缩到 ${targetWidth} × ${targetHeight}，手机上传会更快`
        : '图片尺寸已经适合手机上传。',
  }
}

function colorDistance(a: [number, number, number], b: [number, number, number]) {
  const red = a[0] - b[0]
  const green = a[1] - b[1]
  const blue = a[2] - b[2]
  return Math.sqrt(red * red + green * green + blue * blue)
}

function blendChannel(value: number, target: number, alpha: number) {
  return Math.round(value * alpha + target * (1 - alpha))
}

async function applyImagePreset(dataUrl: string, preset: ImagePreset) {
  if (preset === 'original') {
    return { dataUrl, note: '已恢复到原始构图。' }
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { dataUrl, note: '当前环境不支持裁图，先保留原图。' }
  }

  const image = await dataUrlToImageElement(dataUrl)
  const sourceWidth = image.naturalWidth
  const sourceHeight = image.naturalHeight
  const targetRatio = preset === 'square' ? 1 : 4 / 5

  let cropWidth = sourceWidth
  let cropHeight = Math.round(cropWidth / targetRatio)

  if (cropHeight > sourceHeight) {
    cropHeight = sourceHeight
    cropWidth = Math.round(cropHeight * targetRatio)
  }

  const offsetX = Math.max(0, Math.round((sourceWidth - cropWidth) / 2))
  const offsetY = Math.max(0, Math.round((sourceHeight - cropHeight) / 2))
  const outputWidth = Math.min(cropWidth, preset === 'card' ? 960 : 1080)
  const outputHeight = Math.round(outputWidth / targetRatio)

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const context = canvas.getContext('2d')
  if (!context) {
    return { dataUrl, note: '裁图失败，先保留原图。' }
  }

  context.drawImage(image, offsetX, offsetY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight)

  if (preset === 'studio') {
    const imageData = context.getImageData(0, 0, outputWidth, outputHeight)
    const { data } = imageData
    const corners: Array<[number, number, number]> = [
      [data[0], data[1], data[2]],
      [data[(outputWidth - 1) * 4], data[(outputWidth - 1) * 4 + 1], data[(outputWidth - 1) * 4 + 2]],
      [
        data[(outputWidth * (outputHeight - 1)) * 4],
        data[(outputWidth * (outputHeight - 1)) * 4 + 1],
        data[(outputWidth * (outputHeight - 1)) * 4 + 2],
      ],
      [
        data[(outputWidth * outputHeight - 1) * 4],
        data[(outputWidth * outputHeight - 1) * 4 + 1],
        data[(outputWidth * outputHeight - 1) * 4 + 2],
      ],
    ]

    const backgroundSample: [number, number, number] = [
      Math.round(corners.reduce((sum, color) => sum + color[0], 0) / corners.length),
      Math.round(corners.reduce((sum, color) => sum + color[1], 0) / corners.length),
      Math.round(corners.reduce((sum, color) => sum + color[2], 0) / corners.length),
    ]

    for (let index = 0; index < data.length; index += 4) {
      const pixel: [number, number, number] = [data[index], data[index + 1], data[index + 2]]
      const distance = colorDistance(pixel, backgroundSample)

      if (distance < 42) {
        data[index] = 247
        data[index + 1] = 242
        data[index + 2] = 236
      } else if (distance < 68) {
        const alpha = 0.46
        data[index] = blendChannel(data[index], 247, alpha)
        data[index + 1] = blendChannel(data[index + 1], 242, alpha)
        data[index + 2] = blendChannel(data[index + 2], 236, alpha)
      }
    }

    context.putImageData(imageData, 0, 0)
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.88),
    note:
      preset === 'card'
        ? '已裁成更适合衣物展示的 4:5 卡片'
        : preset === 'studio'
          ? '已整理成更干净的净色卡片，适合首页和衣橱展示'
          : '已裁成正方形，更适合列表封面',
  }
}

function getTryOnStatusLabel(status: TryOnSession['status']) {
  if (status === 'completed') return '已完成'
  if (status === 'processing') return '生成中'
  if (status === 'failed') return '失败'
  return '素材已就绪'
}

function getTryOnProviderLabel(provider?: TryOnSession['provider'] | null) {
  if (provider === 'webhook') return '在线生成'
  if (provider === 'mock') return '预览版'
  return '待生成'
}

function suggestColorGroupFromRgb(red: number, green: number, blue: number): ColorGroup {
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const diff = max - min

  if (max < 90 || diff < 24) return 'black_white_gray'
  if (blue > red + 12 && blue > green - 4) return blue > 150 ? 'blue' : 'denim'
  if (red > 170 && green > 120) return 'khaki_brown'
  if (red > 150 && diff > 45) return 'accent'
  return 'khaki_brown'
}

function inferVisualMeta(category: ClothingCategory, fitType: FitType) {
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

  return { garmentLength: 'short' as GarmentLength, sleeveLength: 'na' as SleeveLength, silhouette: 'straight' as Silhouette }
}

async function buildSmartDraft(
  dataUrl: string,
  preferences: UserPreferences,
  weather: WeatherProfile,
): Promise<SmartDraft> {
  try {
    const remote = await analyzeGarmentImage(dataUrl)
    if (remote.draft && remote.draft.confidence >= 0.55) {
      const providerLabel = remote.draft.provider === 'qwen' ? 'Qwen 视觉' : '视觉模型'
      return {
        category: remote.draft.category,
        colorGroup: remote.draft.colorGroup,
        thickness: remote.draft.thickness,
        style: remote.draft.style,
        seasonFit: remote.draft.seasonFit,
        fitType: remote.draft.fitType,
        garmentLength: remote.draft.garmentLength ?? inferVisualMeta(remote.draft.category, remote.draft.fitType).garmentLength,
        sleeveLength: remote.draft.sleeveLength ?? inferVisualMeta(remote.draft.category, remote.draft.fitType).sleeveLength,
        silhouette: remote.draft.silhouette ?? inferVisualMeta(remote.draft.category, remote.draft.fitType).silhouette,
        name: remote.draft.name || `${colorLabels[remote.draft.colorGroup]}${categoryLabels[remote.draft.category]}`,
        note: `${providerLabel}识别 ${(remote.draft.confidence * 100).toFixed(0)}%：${remote.draft.note}`,
        source: 'ai',
        provider: remote.draft.provider,
        confidence: remote.draft.confidence,
      }
    }
  } catch {
    // Fallback to local heuristic when the vision provider is unavailable.
  }

  let colorGroup: ColorGroup = 'black_white_gray'
  let category: ClothingCategory = 'top'

  if (typeof document !== 'undefined') {
    const image = await dataUrlToImageElement(dataUrl)
    const canvas = document.createElement('canvas')
    canvas.width = 72
    canvas.height = 96
    const context = canvas.getContext('2d')

    if (context) {
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      const corners = [
        [data[0], data[1], data[2]],
        [data[(canvas.width - 1) * 4], data[(canvas.width - 1) * 4 + 1], data[(canvas.width - 1) * 4 + 2]],
        [
          data[((canvas.height - 1) * canvas.width) * 4],
          data[((canvas.height - 1) * canvas.width) * 4 + 1],
          data[((canvas.height - 1) * canvas.width) * 4 + 2],
        ],
        [
          data[((canvas.height - 1) * canvas.width + (canvas.width - 1)) * 4],
          data[((canvas.height - 1) * canvas.width + (canvas.width - 1)) * 4 + 1],
          data[((canvas.height - 1) * canvas.width + (canvas.width - 1)) * 4 + 2],
        ],
      ]
      const background: [number, number, number] = [
        Math.round(corners.reduce((sum, value) => sum + value[0], 0) / corners.length),
        Math.round(corners.reduce((sum, value) => sum + value[1], 0) / corners.length),
        Math.round(corners.reduce((sum, value) => sum + value[2], 0) / corners.length),
      ]

      let red = 0
      let green = 0
      let blue = 0
      let count = 0
      let minX = canvas.width
      let minY = canvas.height
      let maxX = -1
      let maxY = -1
      const rowCoverage = new Array<number>(canvas.height).fill(0)

      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const index = (y * canvas.width + x) * 4
          const distance = colorDistance([data[index], data[index + 1], data[index + 2]], background)
          if (distance < 32) continue

          red += data[index]
          green += data[index + 1]
          blue += data[index + 2]
          count += 1
          rowCoverage[y] += 1
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }

      if (count > 0) {
        colorGroup = suggestColorGroupFromRgb(
          Math.round(red / count),
          Math.round(green / count),
          Math.round(blue / count),
        )

        const subjectHeight = Math.max(1, maxY - minY + 1)
        const subjectWidth = Math.max(1, maxX - minX + 1)
        const heightRatio = subjectHeight / canvas.height
        const widthRatio = subjectWidth / canvas.width
        const topOffsetRatio = minY / canvas.height
        const bottomOffsetRatio = (canvas.height - maxY - 1) / canvas.height
        const topBand = rowCoverage[Math.max(minY, Math.min(canvas.height - 1, minY + Math.round(subjectHeight * 0.18)))] / canvas.width
        const midBand = rowCoverage[Math.max(minY, Math.min(canvas.height - 1, minY + Math.round(subjectHeight * 0.5)))] / canvas.width
        const bottomBand = rowCoverage[Math.max(minY, Math.min(canvas.height - 1, maxY - Math.round(subjectHeight * 0.12)))] / canvas.width

        if (heightRatio < 0.24) category = 'accessory'
        else if (topOffsetRatio > 0.58 && heightRatio < 0.28) category = 'shoes'
        else if (topOffsetRatio > 0.34 && heightRatio < 0.52) category = 'bottom'
        else if (heightRatio > 0.58 && bottomBand > topBand * 1.16) category = 'dress'
        else if (heightRatio > 0.72 && bottomOffsetRatio < 0.16) category = 'dress'
        else if (heightRatio > 0.52 && widthRatio > 0.62) category = 'outerwear'
        else if (midBand > 0.56 && heightRatio > 0.48) category = 'dress'
      }
    }
  }

  const style = preferences.preferredStyles[0] ?? 'commute'

  let thickness: Thickness = 'regular'
  if (category === 'outerwear') {
    thickness = weather.feelsLike >= 25 ? 'light' : weather.feelsLike <= 14 ? 'warm' : 'regular'
  } else if (category === 'accessory') {
    thickness = 'light'
  } else if (category === 'shoes') {
    thickness = 'regular'
  } else if (weather.feelsLike >= 26) {
    thickness = 'light'
  } else if (weather.feelsLike <= 12) {
    thickness = 'warm'
  }

  const seasonFit: SeasonFit =
    category === 'accessory'
      ? 'all_season'
      : thickness === 'warm'
        ? 'winter'
        : weather.feelsLike >= 25
          ? 'summer'
          : weather.feelsLike <= 14
            ? 'winter'
            : 'spring_autumn'
  const fitType: FitType = category === 'bottom' ? 'slim' : category === 'accessory' ? 'slim' : 'regular'
  const visualMeta = inferVisualMeta(category, fitType)

  return {
    category,
    colorGroup,
    thickness,
    style,
    seasonFit,
    fitType,
    garmentLength: visualMeta.garmentLength,
    sleeveLength: visualMeta.sleeveLength,
    silhouette: visualMeta.silhouette,
    name: `${colorLabels[colorGroup]}${categoryLabels[category]}`,
    note: `本地预估为${categoryLabels[category]}，这一步只是粗略建议，保存前请你确认一下。`,
    source: 'local',
    confidence: 0.35,
  }
}

function mapVisionDraftToSmartDraft(draft: VisionDraftPayload): SmartDraft {
  const providerLabel = draft.provider === 'qwen' ? 'Qwen 视觉' : '视觉模型'
  const visualMeta = inferVisualMeta(draft.category, draft.fitType)
  return {
    category: draft.category,
    colorGroup: draft.colorGroup,
    thickness: draft.thickness,
    style: draft.style,
    seasonFit: draft.seasonFit,
    fitType: draft.fitType,
    garmentLength: draft.garmentLength ?? visualMeta.garmentLength,
    sleeveLength: draft.sleeveLength ?? visualMeta.sleeveLength,
    silhouette: draft.silhouette ?? visualMeta.silhouette,
    name: draft.name || `${colorLabels[draft.colorGroup]}${categoryLabels[draft.category]}`,
    note: `${providerLabel}识别 ${(draft.confidence * 100).toFixed(0)}%：${draft.note}`,
    source: 'ai',
    provider: draft.provider,
    confidence: draft.confidence,
  }
}

function normalizeVisionDraftPayload(draft: GarmentAnalyzeResult['draft']): VisionDraftPayload | null {
  if (!draft) return null
  const visualMeta = inferVisualMeta(draft.category, draft.fitType)
  return {
    ...draft,
    garmentLength: draft.garmentLength ?? visualMeta.garmentLength,
    sleeveLength: draft.sleeveLength ?? visualMeta.sleeveLength,
    silhouette: draft.silhouette ?? visualMeta.silhouette,
  }
}

function buildAddFormFromUpload(imageUrl: string, smartDraft: SmartDraft | null, visionDraft: VisionDraftPayload | null): AddFormState {
  const applyDraft = Boolean(smartDraft && visionDraft && visionDraft.confidence >= 0.8)

  return {
    ...addFormDefaults,
    imageUrl,
    name: applyDraft && smartDraft ? smartDraft.name : '',
    category: applyDraft && smartDraft ? smartDraft.category : addFormDefaults.category,
    colorGroup: applyDraft && smartDraft ? smartDraft.colorGroup : addFormDefaults.colorGroup,
    thickness: applyDraft && smartDraft ? smartDraft.thickness : addFormDefaults.thickness,
    style: applyDraft && smartDraft ? smartDraft.style : addFormDefaults.style,
    seasonFit: applyDraft && smartDraft ? smartDraft.seasonFit : addFormDefaults.seasonFit,
    fitType: applyDraft && smartDraft ? smartDraft.fitType : addFormDefaults.fitType,
    garmentLength: applyDraft && smartDraft ? smartDraft.garmentLength : addFormDefaults.garmentLength,
    sleeveLength: applyDraft && smartDraft ? smartDraft.sleeveLength : addFormDefaults.sleeveLength,
    silhouette: applyDraft && smartDraft ? smartDraft.silhouette : addFormDefaults.silhouette,
  }
}

function buildUploadHint(uploaded: GarmentAnalyzeResult) {
  if (uploaded.subjectStats.method === 'ai_studio_fallback') {
    return 'AI 已经先把衣架和背景干扰尽量清掉了，但这张图还不适合强行透明抠图，所以先保留了 AI 整理后的白底单品图。'
  }

  if (!uploaded.subjectStats.extracted) {
    return '这张图和背景太接近，这次先保留了原图，没有强行输出坏掉的主体图。建议换深一点的底色，或先关闭主体提取再上传。'
  }

  if (uploaded.subjectStats.componentCount > 1) {
    return '检测到图里可能不止一件单品，请尽量一张图只放一件，再确认品类后保存。'
  }

  return uploaded.needsConfirmation
    ? '主体已提取，AI 已给建议，请你确认一下品类再保存。'
    : '主体已提取，AI 已自动帮你预填主要标签。'
}

function getCutoutMethodLabel(method?: GarmentAnalyzeResult['subjectStats']['method']) {
  if (method === 'ai_cutout') return 'AI 抠图'
  if (method === 'ai_studio_fallback') return 'AI 灰底整理'
  if (method === 'local_cutout') return '本地抠图'
  if (method === 'fallback_original') return '保留原图'
  return '未识别'
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [scene, setScene] = useState<Scene>(initialPreferences.defaultScene)
  const [selectedCity, setSelectedCity] = useState(cityOptions[0].city)
  const [cityList, setCityList] = useState<Array<{ city: string }>>(cityOptions.map((entry) => ({ city: entry.city })))
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(initialWardrobe)
  const [preferences, setPreferences] = useState<UserPreferences>(initialPreferences)
  const [avatarProfile, setAvatarProfile] = useState<AvatarProfile>(initialAvatarProfile)
  const [weather, setWeather] = useState<WeatherProfile>(cityOptions[0].fallbackWeather)
  const [forecastDay, setForecastDay] = useState<ForecastDay>('today')
  const [dayPart, setDayPart] = useState<DayPart>('daytime')
  const [weatherLoading, setWeatherLoading] = useState(Boolean(initialSessionToken))
  const [weatherError, setWeatherError] = useState('')
  const [bootstrapLoading, setBootstrapLoading] = useState(Boolean(initialSessionToken))
  const [apiMessage, setApiMessage] = useState('')
  const [historyLooks, setHistoryLooks] = useState<SavedLook[]>([])
  const [favoriteLooks, setFavoriteLooks] = useState<SavedLook[]>([])
  const [tryOnSessions, setTryOnSessions] = useState<TryOnSession[]>([])
  const [session, setSession] = useState<UserSession | null>(null)
  const [authChecking, setAuthChecking] = useState(Boolean(initialSessionToken))
  const [loginForm, setLoginForm] = useState<LoginFormState>(loginFormDefaults)
  const [loginMessage, setLoginMessage] = useState('输入手机号后即可获取验证码。')
  const [loginLoading, setLoginLoading] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [avatarPhotoUploading, setAvatarPhotoUploading] = useState(false)
  const [tryOnCreating, setTryOnCreating] = useState(false)
  const [tryOnPreviewingId, setTryOnPreviewingId] = useState('')
  const [selectedTryOnItemId, setSelectedTryOnItemId] = useState('')
  const [tryOnStatusFilter, setTryOnStatusFilter] = useState<TryOnStatusFilter>('all')
  const [previewingTryOnSession, setPreviewingTryOnSession] = useState<TryOnSession | null>(null)
  const [itemSaving, setItemSaving] = useState(false)
  const [imagePreparing, setImagePreparing] = useState(false)
  const [recommendationIndex, setRecommendationIndex] = useState(0)
  const [customLook, setCustomLook] = useState<RecommendationLook | null>(null)
  const [replaceCategory, setReplaceCategory] = useState<ReplaceCategory | null>(null)
  const [addForm, setAddForm] = useState<AddFormState>(addFormDefaults)
  const [rawImageUrl, setRawImageUrl] = useState('')
  const [imagePreset, setImagePreset] = useState<ImagePreset>('studio')
  const [editRawImageUrl, setEditRawImageUrl] = useState('')
  const [editImagePreparing, setEditImagePreparing] = useState(false)
  const [editImagePreset, setEditImagePreset] = useState<ImagePreset>('studio')
  const [subjectCutEnabled, setSubjectCutEnabled] = useState(true)
  const [smartDraftState, setSmartDraftState] = useState<SmartDraft | null>(null)
  const [editSmartDraftState, setEditSmartDraftState] = useState<SmartDraft | null>(null)
  const [smartDraftImageUrl, setSmartDraftImageUrl] = useState('')
  const [editSmartDraftImageUrl, setEditSmartDraftImageUrl] = useState('')
  const [batchExtractionItems, setBatchExtractionItems] = useState<BatchExtractionItem[]>([])
  const [batchExtractionSelectedId, setBatchExtractionSelectedId] = useState<string | null>(null)
  const [batchExtractionTotal, setBatchExtractionTotal] = useState(0)
  const [batchExtractionCompleted, setBatchExtractionCompleted] = useState(0)
  const [batchExtractionCurrentName, setBatchExtractionCurrentName] = useState('')
  const [previewBackdrop, setPreviewBackdrop] = useState<'checker' | 'dark' | 'warm'>('checker')
  const [preferredAddIntake, setPreferredAddIntake] = useState<AddIntakeMode>('camera')
  const [imageHint, setImageHint] = useState('拍一张正面照就够，系统会先帮你压缩，再帮你整理成更适合展示的衣物卡片。')
  const [feedback, setFeedback] = useState('先看今日主推，再按客户反应切到备选方案就可以了。')
  const [editImageHint, setEditImageHint] = useState('换图后也会继续自动整理成更干净的单品卡片。')
  const [savedSection, setSavedSection] = useState<SavedSection>('history')
  const [savedStyleFilter, setSavedStyleFilter] = useState<SavedStyleFilter>('all')
  const [wardrobeFocusId, setWardrobeFocusId] = useState<string | null>(null)
  const [wardrobeEdit, setWardrobeEdit] = useState<WardrobeEditState | null>(null)
  const [wardrobeSaving, setWardrobeSaving] = useState(false)
  const [wardrobeQuickFilter, setWardrobeQuickFilter] = useState<WardrobeQuickFilter>('all')
  const [filters, setFilters] = useState({
    category: 'all',
    colorGroup: 'all',
    style: 'all',
    status: 'all',
    sort: 'smart' as WardrobeSort,
  })

  const forecastWeather = useMemo(
    () => buildForecastWeather(weather, forecastDay, dayPart),
    [dayPart, forecastDay, weather],
  )

  const recommendations = useMemo(
    () => generateRecommendations(wardrobe, preferences, forecastWeather, scene),
    [forecastWeather, preferences, scene, wardrobe],
  )

  const currentLook = customLook ?? recommendations[recommendationIndex] ?? recommendations[0] ?? null

  const alternativeLooks = recommendations
    .filter((look, index) => (customLook ? look.id !== customLook.id : index !== recommendationIndex))
    .slice(0, 2)

  const replacementOptions = useMemo(() => {
    if (!currentLook || !replaceCategory) return []
    const replaced = replaceLookItem(currentLook, replaceCategory, wardrobe, preferences, forecastWeather, scene)
    return replaced ? [replaced] : []
  }, [currentLook, replaceCategory, wardrobe, preferences, forecastWeather, scene])

  const smartDraft = rawImageUrl && smartDraftImageUrl === rawImageUrl ? smartDraftState : null
  const editSmartDraft =
    editRawImageUrl && editSmartDraftImageUrl === editRawImageUrl ? editSmartDraftState : null
  const batchExtractionProgress =
    batchExtractionTotal > 0 ? Math.round((batchExtractionCompleted / batchExtractionTotal) * 100) : 0
  const selectedBatchItem = batchExtractionSelectedId
    ? batchExtractionItems.find((item) => item.id === batchExtractionSelectedId) ?? null
    : null
  const currentPreviewMethod = selectedBatchItem?.method
  const canQuickConfirmAdd = Boolean(
    addForm.imageUrl &&
      addForm.name.trim() &&
      smartDraft &&
      smartDraft.source === 'ai' &&
      (smartDraft.confidence ?? 0) >= 0.8,
  )

  const filteredWardrobe = useMemo(
    () =>
      wardrobe
        .filter((item) => {
          if (filters.category !== 'all' && item.category !== filters.category) return false
          if (filters.colorGroup !== 'all' && item.colorGroup !== filters.colorGroup) return false
          if (filters.style !== 'all' && item.style !== filters.style) return false
          return true
        })
        .filter((item) => {
          if (wardrobeQuickFilter === 'all') return true
          if (wardrobeQuickFilter === 'recently_worn') return toSortableTime(item.lastWornAt) > 0
          if (wardrobeQuickFilter === 'recently_added') {
            const originalIndex = wardrobe.findIndex((entry) => entry.id === item.id)
            const threshold = Math.min(8, wardrobe.length || 8)
            return originalIndex >= 0 && originalIndex < threshold
          }
          return true
        })
        .sort((left, right) => {
          if (filters.sort === 'name') {
            return left.name.localeCompare(right.name, 'zh-CN')
          }

          if (filters.sort === 'recent') {
            return toSortableTime(right.lastWornAt) - toSortableTime(left.lastWornAt) || right.wearCount - left.wearCount
          }

          if (filters.sort === 'most_worn') {
            return right.wearCount - left.wearCount || toSortableTime(right.lastWornAt) - toSortableTime(left.lastWornAt)
          }

          const recentGap = toSortableTime(right.lastWornAt) - toSortableTime(left.lastWornAt)
          if (recentGap !== 0) return recentGap

          const wearGap = right.wearCount - left.wearCount
          if (wearGap !== 0) return wearGap

          return left.name.localeCompare(right.name, 'zh-CN')
        }),
    [filters, wardrobe, wardrobeQuickFilter],
  )
  const hasActiveWardrobeFilters = filters.category !== 'all' || filters.colorGroup !== 'all' || filters.style !== 'all'

  const wardrobeSummary = useMemo(() => {
    const recentCount = filteredWardrobe.filter((item) => toSortableTime(item.lastWornAt) > 0).length
    const topCount = filteredWardrobe.filter((item) => item.category === 'top').length
    const shoesCount = filteredWardrobe.filter((item) => item.category === 'shoes').length
    return {
      total: filteredWardrobe.length,
      recentCount,
      topCount,
      shoesCount,
    }
  }, [filteredWardrobe])

  const tryOnReadyItems = useMemo(
    () =>
      wardrobe.filter(
        (item) =>
          item.category !== 'accessory' &&
          Boolean(item.imageUrl) &&
          Boolean(item.garmentLength) &&
          Boolean(item.sleeveLength) &&
          Boolean(item.silhouette),
      ),
    [wardrobe],
  )

  const tryOnReadiness = useMemo(() => {
    const tops = tryOnReadyItems.filter((item) => item.category === 'top').length
    const bottoms = tryOnReadyItems.filter((item) => item.category === 'bottom').length
    const dresses = tryOnReadyItems.filter((item) => item.category === 'dress').length
    const outerwear = tryOnReadyItems.filter((item) => item.category === 'outerwear').length
    const shoes = tryOnReadyItems.filter((item) => item.category === 'shoes').length
    const hasTryOnPhoto = Boolean(avatarProfile.tryOnPhotoUrl)
    const canStartPreview = hasTryOnPhoto && (tops > 0 || dresses > 0) && (bottoms > 0 || dresses > 0)

    return {
      tops,
      bottoms,
      dresses,
      outerwear,
      shoes,
      hasTryOnPhoto,
      canStartPreview,
      readyCount: tryOnReadyItems.length,
    }
  }, [avatarProfile.tryOnPhotoUrl, tryOnReadyItems])

  const filteredSavedLooks = useMemo(() => {
    const entries = savedSection === 'history' ? historyLooks : favoriteLooks
    if (savedStyleFilter === 'all') return entries
    return entries.filter((entry) => entry.look.style === savedStyleFilter)
  }, [favoriteLooks, historyLooks, savedSection, savedStyleFilter])

  const editingWardrobeItem = useMemo(
    () => wardrobe.find((item) => item.id === wardrobeEdit?.id) ?? null,
    [wardrobe, wardrobeEdit?.id],
  )

  const focusedWardrobeItem = useMemo(
    () => wardrobe.find((item) => item.id === wardrobeFocusId) ?? null,
    [wardrobe, wardrobeFocusId],
  )
  const selectedTryOnItem = useMemo(
    () => tryOnReadyItems.find((item) => item.id === selectedTryOnItemId) ?? null,
    [selectedTryOnItemId, tryOnReadyItems],
  )
  const filteredTryOnSessions = useMemo(() => {
    if (tryOnStatusFilter === 'all') return tryOnSessions
    return tryOnSessions.filter((entry) => entry.status === tryOnStatusFilter)
  }, [tryOnSessions, tryOnStatusFilter])

  useEffect(() => {
    const token = initialSessionToken
    if (!token) {
      return
    }

    setAuthToken(token)
    fetchSession()
      .then((nextSession) => {
        setSession(nextSession.user)
      })
      .catch(() => {
        window.localStorage.removeItem(sessionStorageKey)
        setAuthToken('')
      })
      .finally(() => {
        setAuthChecking(false)
      })
  }, [])

  useEffect(() => {
    if (!session) return

    let ignore = false

    fetchBootstrap()
      .then((data) => {
        if (ignore) return
        const bootstrapCity = cityOptions.find((entry) => entry.city === data.selectedCity) ?? cityOptions[0]
        setWardrobe(data.wardrobe)
        setPreferences(data.preferences)
        setAvatarProfile(data.avatarProfile)
        setWeather(bootstrapCity.fallbackWeather)
        setWeatherError('')
        setWeatherLoading(true)
        setSelectedCity(data.selectedCity)
        setScene(data.preferences.defaultScene)
        setCityList(data.cities)
        setHistoryLooks(data.history)
        setFavoriteLooks(data.favorites)
        setTryOnSessions(data.tryOnSessions)
        setApiMessage('')
      })
      .catch((error: Error) => {
        if (!ignore) setApiMessage(error.message || '内容加载慢了一点，请稍后再试。')
      })
      .finally(() => {
        if (!ignore) setBootstrapLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [session])

  useEffect(() => {
    if (!session) return

    let ignore = false
    const city = cityOptions.find((entry) => entry.city === selectedCity) ?? cityOptions[0]

    fetchWeather(city.city)
      .then((nextWeather) => {
        if (!ignore) setWeather(nextWeather)
      })
      .catch(() => {
        if (!ignore) {
          setWeather(city.fallbackWeather)
          setWeatherError('实时天气暂时没连上，先按当前城市继续推荐。')
        }
      })
      .finally(() => {
        if (!ignore) setWeatherLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [selectedCity, session])

  useEffect(() => {
    if (!selectedTryOnItemId && tryOnReadyItems.length > 0) {
      setSelectedTryOnItemId(tryOnReadyItems[0].id)
      return
    }

    if (selectedTryOnItemId && !tryOnReadyItems.some((item) => item.id === selectedTryOnItemId)) {
      setSelectedTryOnItemId(tryOnReadyItems[0]?.id ?? '')
    }
  }, [selectedTryOnItemId, tryOnReadyItems])

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setRecommendationIndex(0)
      setCustomLook(null)
      setReplaceCategory(null)
    }, 0)

    return () => {
      window.clearTimeout(resetTimer)
    }
  }, [wardrobe, preferences, scene, selectedCity, forecastDay, dayPart, forecastWeather.feelsLike, forecastWeather.tempGap, forecastWeather.rainProbability])

  useEffect(() => {
    if (!rawImageUrl) return

    if (smartDraftState && smartDraftState.source === 'ai' && smartDraftImageUrl === rawImageUrl) {
      return
    }

    let ignore = false
    buildSmartDraft(rawImageUrl, preferences, weather)
      .then((draft) => {
        if (!ignore) {
          setSmartDraftState(draft)
          setSmartDraftImageUrl(rawImageUrl)
        }
      })
      .catch(() => {
        if (!ignore) {
          setSmartDraftState(null)
          setSmartDraftImageUrl(rawImageUrl)
        }
      })

    return () => {
      ignore = true
    }
  }, [preferences, rawImageUrl, smartDraftImageUrl, smartDraftState, weather])

  useEffect(() => {
    if (!editRawImageUrl || !wardrobeEdit) return

    if (editSmartDraftState && editSmartDraftState.source === 'ai' && editSmartDraftImageUrl === editRawImageUrl) {
      return
    }

    let ignore = false
    buildSmartDraft(editRawImageUrl, preferences, weather)
      .then((draft) => {
        if (!ignore) {
          setEditSmartDraftState(draft)
          setEditSmartDraftImageUrl(editRawImageUrl)
        }
      })
      .catch(() => {
        if (!ignore) {
          setEditSmartDraftState(null)
          setEditSmartDraftImageUrl(editRawImageUrl)
        }
      })

    return () => {
      ignore = true
    }
  }, [editRawImageUrl, editSmartDraftImageUrl, editSmartDraftState, preferences, wardrobeEdit, weather])

  const applyBatchExtractionItem = (item: BatchExtractionItem) => {
    if (item.status !== 'done') return
    setBatchExtractionSelectedId(item.id)
    setRawImageUrl(item.rawImageUrl)
    setImagePreset('studio')
    setAddForm(item.formValues)
    setSmartDraftState(item.draft)
    setSmartDraftImageUrl(item.rawImageUrl)
    setImageHint(item.hint)
  }

  const clearBatchExtraction = () => {
    setBatchExtractionItems([])
    setBatchExtractionSelectedId(null)
    setBatchExtractionTotal(0)
    setBatchExtractionCompleted(0)
    setBatchExtractionCurrentName('')
  }

  const openAddIntake = (mode: AddIntakeMode) => {
    if (typeof document === 'undefined') return
    const targetId =
      mode === 'camera' ? 'add-intake-camera' : mode === 'gallery' ? 'add-intake-gallery' : 'add-intake-batch'
    const input = document.getElementById(targetId) as HTMLInputElement | null
    if (!input) return
    input.value = ''
    setPreferredAddIntake(mode)
    setImageHint(intakeModeMeta[mode].note)
    input.click()
  }

  const updatePreferences = (nextPreferences: UserPreferences) => {
    setPreferences(nextPreferences)
    savePreferences(nextPreferences).catch(() => {
      setApiMessage('偏好已经更新。')
    })
  }

  const updateCity = (nextCity: string) => {
    const city = cityOptions.find((entry) => entry.city === nextCity) ?? cityOptions[0]
    setWeather(city.fallbackWeather)
    setWeatherLoading(true)
    setWeatherError('')
    setSelectedCity(nextCity)
    saveSelectedCity(nextCity).catch(() => {
      setApiMessage('城市已经切换成功。')
    })
  }

  const updateAvatarField = <Key extends keyof AvatarProfile,>(key: Key, value: AvatarProfile[Key]) => {
    setAvatarProfile((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const handleSaveAvatarProfile = async () => {
    setAvatarSaving(true)
    try {
      const saved = await saveAvatarProfile(avatarProfile)
      setAvatarProfile(saved)
      setFeedback('身材档案已经保存好了，后续推荐会更贴近你。')
      setApiMessage('')
    } catch {
      setApiMessage('保存慢了一点，请稍后再试一次。')
    } finally {
      setAvatarSaving(false)
    }
  }

  const openTryOnPhotoPicker = () => {
    if (typeof document === 'undefined') return
    const input = document.getElementById('try-on-photo-input') as HTMLInputElement | null
    if (!input) return
    input.value = ''
    input.click()
  }

  const handleTryOnPhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setAvatarPhotoUploading(true)
    try {
      const optimized = await optimizeImageForMobile(file)
      const uploaded = await uploadWardrobeImage(optimized.dataUrl, 'standard')
      const nextProfile = {
        ...avatarProfile,
        tryOnPhotoUrl: uploaded.imageUrl,
      }
      const saved = await saveAvatarProfile(nextProfile)
      setAvatarProfile(saved)
      setFeedback('参考照已经准备好了，后面看上身效果会更顺。')
      setApiMessage('')
    } catch {
      setApiMessage('图片上传慢了一点，请再试一次。')
    } finally {
      setAvatarPhotoUploading(false)
      event.target.value = ''
    }
  }

  const handleCreateTryOnSession = async () => {
    if (!selectedTryOnItemId) {
      setFeedback('先选一件想试穿的单品，再创建试穿任务。')
      return
    }

    setTryOnCreating(true)
    try {
      const created = await createTryOnSession(selectedTryOnItemId)
      setTryOnSessions((current) => [created, ...current])
      setActiveTab('tryon')
      setFeedback('试穿任务已经建好了，可以继续生成预览。')
      setApiMessage('')
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : '试穿任务创建失败了。')
    } finally {
      setTryOnCreating(false)
    }
  }

  const handleCreateMockPreview = async (sessionId: string) => {
    setTryOnPreviewingId(sessionId)
    try {
      const updated = await generateTryOnPreview(sessionId)
      setTryOnSessions((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
      setFeedback('试穿预览已经生成好了，可以直接拿来演示。')
      setApiMessage('')
    } catch (error) {
      if (error instanceof Error) {
        setApiMessage(error.message)
      } else {
        setApiMessage('试穿预览生成失败了，请稍后再试。')
      }
    } finally {
      setTryOnPreviewingId('')
    }
  }

  const handleRequestCode = async () => {
    if (!/^\d{11}$/.test(loginForm.phone.trim())) {
      setLoginMessage('请输入 11 位手机号。')
      return
    }

    setLoginLoading(true)
    try {
      const response = await requestLoginCode(loginForm.phone.trim())
      setLoginMessage(`${response.message} 验证码：${response.devCode}`)
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : '验证码发送失败。')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginLoading(true)
    try {
      const result = await verifyLoginCode(loginForm.phone.trim(), loginForm.code.trim())
      window.localStorage.setItem(sessionStorageKey, result.token)
      setBootstrapLoading(true)
      setWeatherLoading(true)
      setWeatherError('')
      setSession(result.user)
      setLoginForm(loginFormDefaults)
      setApiMessage('')
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : '登录失败，请重试。')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logoutSession()
    } catch {
      // Ignore logout network failures.
    }

    window.localStorage.removeItem(sessionStorageKey)
    setAuthToken('')
    setSession(null)
    setHistoryLooks([])
    setFavoriteLooks([])
    setTryOnSessions([])
    setPreviewingTryOnSession(null)
    setAvatarProfile(initialAvatarProfile)
    setBootstrapLoading(false)
  }

  const handleDeleteItem = (id: string) => {
    const previous = wardrobe
    if (wardrobeEdit?.id === id) setWardrobeEdit(null)
    if (wardrobeFocusId === id) setWardrobeFocusId(null)
    setWardrobe((current) => current.filter((item) => item.id !== id))
    deleteWardrobeItem(id)
      .then(() => {
        setFeedback('这件衣物已经删掉了，对应图片也会一起清理。')
      })
      .catch(() => {
        setWardrobe(previous)
        setApiMessage('删除失败了，请稍后再试。')
      })
  }

  const openWardrobeEditor = (item: WardrobeItem) => {
    setWardrobeFocusId(item.id)
    setEditRawImageUrl('')
    setEditImagePreset('studio')
    setEditImageHint('换图后也会继续自动整理成更干净的单品卡片。')
    setWardrobeEdit({
      id: item.id,
      name: item.name,
      category: item.category,
      colorGroup: item.colorGroup,
      thickness: item.thickness,
      style: item.style,
      seasonFit: item.seasonFit,
      fitType: item.fitType,
      garmentLength: item.garmentLength ?? inferVisualMeta(item.category, item.fitType).garmentLength,
      sleeveLength: item.sleeveLength ?? inferVisualMeta(item.category, item.fitType).sleeveLength,
      silhouette: item.silhouette ?? inferVisualMeta(item.category, item.fitType).silhouette,
      imageUrl: item.imageUrl ?? '',
    })
  }

  const handleSaveWardrobeEdit = async () => {
    if (!wardrobeEdit || !editingWardrobeItem) return
    if (!wardrobeEdit.name.trim()) {
      setFeedback('先给这件衣服保留一个容易识别的名字。')
      return
    }

    setWardrobeSaving(true)
    let storedImageUrl: string
    if (wardrobeEdit.imageUrl.startsWith('data:image/')) {
      const uploaded = await uploadWardrobeImage(wardrobeEdit.imageUrl, subjectCutEnabled ? 'subject' : 'standard')
      storedImageUrl = uploaded.imageUrl
    } else if (wardrobeEdit.imageUrl) {
      storedImageUrl = wardrobeEdit.imageUrl
    } else {
      storedImageUrl = ''
    }
    const payload: WardrobeItem = {
      ...editingWardrobeItem,
      name: wardrobeEdit.name.trim(),
      category: wardrobeEdit.category,
      colorGroup: wardrobeEdit.colorGroup,
      thickness: wardrobeEdit.thickness,
      style: wardrobeEdit.style,
      status: editingWardrobeItem.status,
      seasonFit: wardrobeEdit.seasonFit,
      fitType: wardrobeEdit.fitType,
      garmentLength: wardrobeEdit.garmentLength,
      sleeveLength: wardrobeEdit.sleeveLength,
      silhouette: wardrobeEdit.silhouette,
      imageUrl: storedImageUrl || null,
    }

    try {
      const updated = await updateWardrobeItem(payload)
      setWardrobe((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setWardrobeEdit({
        id: updated.id,
        name: updated.name,
        category: updated.category,
        colorGroup: updated.colorGroup,
        thickness: updated.thickness,
        style: updated.style,
        seasonFit: updated.seasonFit,
        fitType: updated.fitType,
        garmentLength: updated.garmentLength ?? inferVisualMeta(updated.category, updated.fitType).garmentLength,
        sleeveLength: updated.sleeveLength ?? inferVisualMeta(updated.category, updated.fitType).sleeveLength,
        silhouette: updated.silhouette ?? inferVisualMeta(updated.category, updated.fitType).silhouette,
        imageUrl: updated.imageUrl ?? '',
      })
      setEditRawImageUrl('')
      setEditImagePreset('studio')
      setEditImageHint('换图后也会继续自动整理成更干净的单品卡片。')
      setFeedback('这件衣服已经更新好了，后面的推荐会按新标签来。')
    } catch {
      setApiMessage('衣物修改失败了，请稍后再试。')
    } finally {
      setWardrobeSaving(false)
    }
  }

  const handleRemoveFavorite = (id: string) => {
    const previous = favoriteLooks
    setFavoriteLooks((current) => current.filter((entry) => entry.id !== id))
    deleteFavoriteLook(id).catch(() => {
      setFavoriteLooks(previous)
      setApiMessage('取消收藏失败了，请稍后再试。')
    })
  }

  const handleWearLook = () => {
    if (!currentLook) return

    const today = new Date().toISOString().slice(0, 10)
    const itemIds = currentLook.items.map((entry) => entry.item.id)
    const itemIdSet = new Set(itemIds)

    setWardrobe((current) =>
      current.map((item) =>
        itemIdSet.has(item.id)
          ? {
              ...item,
              wearCount: item.wearCount + 1,
              lastWornAt: today,
              preferenceScore: Math.min(100, item.preferenceScore + 2),
            }
          : item,
      ),
    )
    setHistoryLooks((current) => [buildLocalHistoryEntry(currentLook), ...current].slice(0, 10))
    setFeedback('已记录今天穿这套，后面会更优先推荐类似风格。')

    recordLookWear(itemIds, today, currentLook)
      .then((response) => {
        setWardrobe(response.wardrobe)
      })
      .catch(() => {
        setApiMessage('这次记录慢了一点，请稍后再试。')
      })
  }

  const handleFavoriteLook = () => {
    if (!currentLook) return
    saveFavoriteLook(currentLook)
      .then((saved) => {
        setFavoriteLooks((current) => [saved, ...current])
        setSavedSection('favorite')
        setFeedback('这套已经收藏好了，之后可以在“我的”里快速回看。')
      })
      .catch(() => {
        setApiMessage('收藏失败了，请稍后再试。')
      })
  }

  const handleRefreshLook = () => {
    if (recommendations.length <= 1) return
    setCustomLook(null)
    setRecommendationIndex((current) => (current + 1) % recommendations.length)
    setReplaceCategory(null)
    setFeedback('已经换成同天气、同场景下的另一套方案。')
  }

  const applyReplacement = (look: RecommendationLook) => {
    setCustomLook(look)
    setReplaceCategory(null)
    setFeedback(look.reasons[look.reasons.length - 1] ?? '已经替换成更协调的单品。')
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    setImagePreparing(true)
    setImageHint(files.length > 1 ? `正在批量处理 ${files.length} 张图片…` : '正在上传图片，系统会一起完成主体提取和品类识别。')
    clearBatchExtraction()
    setBatchExtractionTotal(files.length)

    try {
      const nextItems: BatchExtractionItem[] = []

      for (const [index, file] of files.entries()) {
        setBatchExtractionCurrentName(file.name)

        try {
          const optimized = await optimizeImageForMobile(file)
          const uploaded = await uploadAndAnalyzeGarment(optimized.dataUrl, subjectCutEnabled ? 'subject' : 'standard')
          const normalizedVisionDraft = normalizeVisionDraftPayload(uploaded.draft)
          const nextDraft = normalizedVisionDraft ? mapVisionDraftToSmartDraft(normalizedVisionDraft) : null
          const nextItem: BatchExtractionItem = {
            id: `batch-${crypto.randomUUID()}`,
            fileName: file.name,
            rawImageUrl: optimized.dataUrl,
            imageUrl: uploaded.imageUrl,
            draft: nextDraft,
            visionDraft: normalizedVisionDraft,
            extracted: uploaded.subjectStats.extracted,
            componentCount: uploaded.subjectStats.componentCount,
            method: uploaded.subjectStats.method,
            needsConfirmation: uploaded.needsConfirmation,
            hint: buildUploadHint(uploaded),
            formValues: buildAddFormFromUpload(uploaded.imageUrl, nextDraft, normalizedVisionDraft),
            status: 'done',
          }

          nextItems.push(nextItem)
          setBatchExtractionItems([...nextItems])

          if (!batchExtractionSelectedId && nextItems.length === 1) {
            applyBatchExtractionItem(nextItem)
          }
        } catch {
          nextItems.push({
            id: `batch-${crypto.randomUUID()}`,
            fileName: file.name,
            rawImageUrl: '',
            imageUrl: '',
            draft: null,
            visionDraft: null,
            extracted: false,
            componentCount: 0,
            method: 'fallback_original',
            needsConfirmation: true,
            hint: '这张图片处理失败了，可以单独再试一次。',
            formValues: addFormDefaults,
            status: 'error',
            errorMessage: '处理失败',
          })
          setBatchExtractionItems([...nextItems])
        } finally {
          setBatchExtractionCompleted(index + 1)
        }
      }

      const firstSuccess = nextItems.find((item) => item.status === 'done') ?? null
      if (firstSuccess) {
        applyBatchExtractionItem(firstSuccess)
      } else {
        setImageHint('这批图片都没处理成功，可以换一批再试。')
      }
    } finally {
      setImagePreparing(false)
      setBatchExtractionCurrentName('')
      event.target.value = ''
    }
  }

  const handleApplyPreset = async (preset: ImagePreset) => {
    if (!rawImageUrl) return
    setImagePreparing(true)
    try {
      const next = await applyImagePreset(rawImageUrl, preset)
      setImagePreset(preset)
      setAddForm((current) => ({ ...current, imageUrl: next.dataUrl }))
      setImageHint(next.note)
    } catch {
      setImageHint('裁图失败了，先保留当前版本。')
    } finally {
      setImagePreparing(false)
    }
  }

  const handleWardrobeEditImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setEditImagePreparing(true)
    setEditImageHint('正在上传新图片，系统会一起完成主体提取和品类识别。')

    try {
      const optimized = await optimizeImageForMobile(file)
      setEditRawImageUrl(optimized.dataUrl)
      setEditImagePreset('studio')
      const uploaded = await uploadAndAnalyzeGarment(optimized.dataUrl, subjectCutEnabled ? 'subject' : 'standard')
      const normalizedVisionDraft = normalizeVisionDraftPayload(uploaded.draft)
      const nextDraft = normalizedVisionDraft ? mapVisionDraftToSmartDraft(normalizedVisionDraft) : null
      setEditSmartDraftState(nextDraft)
      setEditSmartDraftImageUrl(optimized.dataUrl)
      setWardrobeEdit((current) =>
        current
          ? {
              ...current,
              imageUrl: uploaded.imageUrl,
              name: nextDraft && normalizedVisionDraft && normalizedVisionDraft.confidence >= 0.8 ? (current.name.trim() ? current.name : nextDraft.name) : current.name,
              category: nextDraft && normalizedVisionDraft && normalizedVisionDraft.confidence >= 0.8 ? nextDraft.category : current.category,
              colorGroup: nextDraft && normalizedVisionDraft && normalizedVisionDraft.confidence >= 0.8 ? nextDraft.colorGroup : current.colorGroup,
              thickness: nextDraft && normalizedVisionDraft && normalizedVisionDraft.confidence >= 0.8 ? nextDraft.thickness : current.thickness,
              style: nextDraft && normalizedVisionDraft && normalizedVisionDraft.confidence >= 0.8 ? nextDraft.style : current.style,
              seasonFit: nextDraft && normalizedVisionDraft && normalizedVisionDraft.confidence >= 0.8 ? nextDraft.seasonFit : current.seasonFit,
              fitType: nextDraft && normalizedVisionDraft && normalizedVisionDraft.confidence >= 0.8 ? nextDraft.fitType : current.fitType,
              garmentLength: nextDraft && normalizedVisionDraft && normalizedVisionDraft.confidence >= 0.8 ? nextDraft.garmentLength : current.garmentLength,
              sleeveLength: nextDraft && normalizedVisionDraft && normalizedVisionDraft.confidence >= 0.8 ? nextDraft.sleeveLength : current.sleeveLength,
              silhouette: nextDraft && normalizedVisionDraft && normalizedVisionDraft.confidence >= 0.8 ? nextDraft.silhouette : current.silhouette,
            }
          : current,
      )
      setEditImageHint(buildUploadHint(uploaded))
    } catch {
      setEditImageHint('这张新图片处理失败了，可以换一张再试。')
    } finally {
      setEditImagePreparing(false)
      event.target.value = ''
    }
  }

  const handleApplyWardrobeEditPreset = async (preset: ImagePreset) => {
    if (!editRawImageUrl) return
    setEditImagePreparing(true)
    try {
      const next = await applyImagePreset(editRawImageUrl, preset)
      setEditImagePreset(preset)
      setWardrobeEdit((current) => (current ? { ...current, imageUrl: next.dataUrl } : current))
      setEditImageHint(next.note)
    } catch {
      setEditImageHint('换图裁剪失败了，先保留当前版本。')
    } finally {
      setEditImagePreparing(false)
    }
  }

  const handleClearAddImage = () => {
    setAddForm((current) => ({ ...current, imageUrl: '' }))
    setRawImageUrl('')
    setImagePreset('studio')
    setSmartDraftState(null)
    setSmartDraftImageUrl('')
    setBatchExtractionSelectedId(null)
    setImageHint('图片已移除，现在会恢复为纯色卡片占位。')
  }

  const handleRemoveWardrobeEditImage = () => {
    setWardrobeEdit((current) => (current ? { ...current, imageUrl: '' } : current))
    setEditRawImageUrl('')
    setEditImagePreset('studio')
    setEditSmartDraftState(null)
    setEditSmartDraftImageUrl('')
    setEditImageHint('这件衣服的图片已移除，保存后会恢复成纯色卡片占位。')
  }

  const applySmartDraft = () => {
    if (!smartDraft) return
    setAddForm((current) => ({
      ...current,
      name: current.name.trim() ? current.name : smartDraft.name,
      category: smartDraft.category,
      colorGroup: smartDraft.colorGroup,
      thickness: smartDraft.thickness,
      style: smartDraft.style,
      seasonFit: smartDraft.seasonFit,
      fitType: smartDraft.fitType,
      garmentLength: smartDraft.garmentLength,
      sleeveLength: smartDraft.sleeveLength,
      silhouette: smartDraft.silhouette,
    }))
    setFeedback('已套用图片建议标签，你只需要再检查一下是否符合这件衣服。')
  }

  const applyWardrobeEditSmartDraft = () => {
    if (!editSmartDraft) return
    setWardrobeEdit((current) =>
      current
        ? {
            ...current,
            name: current.name.trim() ? current.name : editSmartDraft.name,
            category: editSmartDraft.category,
            colorGroup: editSmartDraft.colorGroup,
            thickness: editSmartDraft.thickness,
            style: editSmartDraft.style,
            seasonFit: editSmartDraft.seasonFit,
            fitType: editSmartDraft.fitType,
            garmentLength: editSmartDraft.garmentLength,
            sleeveLength: editSmartDraft.sleeveLength,
            silhouette: editSmartDraft.silhouette,
          }
        : current,
    )
    setFeedback('换图后的建议标签已经套用，这件衣服后面的推荐会更快变准。')
  }

  const handleAddItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!addForm.name.trim()) {
      setFeedback('先给这件衣服起个名字，后面找起来会快很多。')
      return
    }

    setItemSaving(true)

    const persist = async () => {
      let storedImageUrl = ''
      if (addForm.imageUrl.startsWith('data:image/')) {
        const uploaded = await uploadWardrobeImage(addForm.imageUrl, subjectCutEnabled ? 'subject' : 'standard')
        storedImageUrl = uploaded.imageUrl
      } else if (addForm.imageUrl) {
        storedImageUrl = addForm.imageUrl
      }

      const newItem: WardrobeItem = {
        id: `item-${crypto.randomUUID()}`,
        name: addForm.name.trim(),
        category: addForm.category,
        colorGroup: addForm.colorGroup,
        thickness: addForm.thickness,
        style: addForm.style,
        status: 'ready',
        seasonFit: addForm.seasonFit,
        fitType: addForm.fitType,
        garmentLength: addForm.garmentLength,
        sleeveLength: addForm.sleeveLength,
        silhouette: addForm.silhouette,
        preferenceScore: 75,
        wearCount: 0,
        isDisliked: false,
        imageUrl: storedImageUrl || undefined,
      }

      const savedItem = await createWardrobeItem(newItem)
      const remainingBatchItems = batchExtractionSelectedId
        ? batchExtractionItems.filter((item) => item.id !== batchExtractionSelectedId)
        : batchExtractionItems
      const nextBatchItem = remainingBatchItems.find((item) => item.status === 'done') ?? null

      setWardrobe((current) => [savedItem, ...current])

      if (nextBatchItem) {
        setBatchExtractionItems(remainingBatchItems)
        applyBatchExtractionItem(nextBatchItem)
        setFeedback('这件衣物已经加入衣橱，已经自动切到下一张批量结果，继续确认后保存就行。')
      } else {
        setAddForm(addFormDefaults)
        setRawImageUrl('')
        setImagePreset('studio')
        setSubjectCutEnabled(true)
        setSmartDraftState(null)
        setSmartDraftImageUrl('')
        setBatchExtractionSelectedId(null)
        clearBatchExtraction()
        setImageHint('拍一张正面照就够，系统会先帮你压缩，再帮你整理成更适合展示的衣物卡片。')
        setActiveTab('home')
        setFeedback('新衣物已加入衣橱，现在会参与今日推荐。')
      }
    }

    persist()
      .catch(() => {
        setApiMessage('衣物或图片保存失败了，请稍后再试。')
      })
      .finally(() => {
        setItemSaving(false)
      })
  }

  const renderItemVisual = (item: WardrobeItem) => (
    <div className={`item-visual tone-${item.colorGroup} category-${item.category}`}>
      {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <span>{categoryLabels[item.category]}</span>}
    </div>
  )

  const renderLookStage = (look: RecommendationLook, compact = false) => {
    const dress = look.items.find((entry) => entry.item.category === 'dress')?.item
    const top = look.items.find((entry) => entry.item.category === 'top')?.item
    const bottom = look.items.find((entry) => entry.item.category === 'bottom')?.item
    const outerwear = look.items.find((entry) => entry.item.category === 'outerwear')?.item
    const shoes = look.items.find((entry) => entry.item.category === 'shoes')?.item
    const accessory = look.items.find((entry) => entry.item.category === 'accessory')?.item

    const inferAccessoryMount = (item: WardrobeItem | undefined) => {
      if (!item) return 'mount-neck'
      const name = item.name.toLowerCase()
      if (name.includes('帽') || name.includes('hat') || name.includes('cap')) return 'mount-head'
      if (name.includes('包') || name.includes('bag')) return 'mount-shoulder'
      if (name.includes('腰') || name.includes('belt')) return 'mount-waist'
      if (name.includes('耳') || name.includes('ear')) return 'mount-face'
      return item.style === 'casual' ? 'mount-shoulder' : item.style === 'commute' ? 'mount-waist' : 'mount-neck'
    }

    const accessoryMount = inferAccessoryMount(accessory)

    const buildStageVariant = (item: WardrobeItem | undefined, category: ClothingCategory) => {
      if (!item) return ''

      const variants = [`fit-${item.fitType}`, `weight-${item.thickness}`, `season-${item.seasonFit}`]
      const name = item.name.toLowerCase()

      if (category === 'top' || category === 'outerwear') {
        const lengthClass =
          item.seasonFit === 'winter' || item.thickness === 'warm'
            ? 'length-long'
            : item.fitType === 'slim' && item.thickness === 'light'
              ? 'length-short'
              : 'length-regular'
        variants.push(lengthClass)
      }

      if (category === 'dress') {
        const dressLength =
          item.seasonFit === 'winter' || item.thickness === 'warm'
            ? 'length-maxi'
            : item.fitType === 'slim'
              ? 'length-short'
              : 'length-midi'
        variants.push(dressLength)
      }

      if (category === 'bottom') {
        variants.push(item.fitType === 'relaxed' ? 'rise-wide' : item.fitType === 'slim' ? 'rise-slim' : 'rise-regular')
      }

      if (category === 'shoes') {
        variants.push(item.style === 'refined' ? 'shoe-refined' : item.style === 'casual' ? 'shoe-casual' : 'shoe-commute')
      }

      if (category === 'accessory') {
        variants.push(inferAccessoryMount(item))
        variants.push(item.style === 'refined' ? 'accent-jewel' : item.style === 'casual' ? 'accent-soft' : 'accent-structured')
      }

      const needsFarScale =
        name.includes('长') ||
        name.includes('大衣') ||
        name.includes('开衫') ||
        name.includes('风衣') ||
        name.includes('连衣') ||
        name.includes('半裙')
      const needsCloseScale = name.includes('短') || name.includes('吊带') || name.includes('项链')
      const upperFocus = category === 'top' || category === 'outerwear' || category === 'dress'
      const lowerFocus = category === 'bottom' || category === 'shoes'

      variants.push(needsFarScale ? 'scale-far' : needsCloseScale ? 'scale-close' : 'scale-regular')
      variants.push(upperFocus ? 'crop-upper' : lowerFocus ? 'crop-lower' : 'crop-center')

      if (category === 'outerwear' && (name.includes('西装') || name.includes('开衫') || name.includes('大衣'))) {
        variants.push('front-open')
      }
      if (category === 'dress' && (name.includes('裙') || name.includes('dress'))) {
        variants.push('hem-soft')
      }
      if (category === 'bottom' && (name.includes('阔腿') || item.fitType === 'relaxed')) {
        variants.push('leg-wide')
      }
      if (category === 'accessory' && (name.includes('包') || name.includes('bag'))) {
        variants.push('swing-drop')
      }

      return variants.join(' ')
    }

    const renderStageLayer = (
      item: WardrobeItem | undefined,
      className: string,
      fallbackLabel: string,
      category: ClothingCategory,
    ) => (
      <div
        className={`stage-layer ${className} ${item?.imageUrl ? 'has-image' : 'no-image'} ${buildStageVariant(item, category)} ${
          item ? `tone-${item.colorGroup}` : 'tone-black_white_gray'
        }`}
      >
        {item?.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <span>{fallbackLabel}</span>}
        <div className="stage-edge stage-edge-shadow" />
        <div className="stage-edge stage-edge-sheen" />
      </div>
    )

    return (
      <div
        className={`look-stage${compact ? ' compact' : ''}${dress ? ' has-dress' : ''}${outerwear ? ' has-outerwear' : ''}${
          accessory ? ` ${accessoryMount}` : ''
        }`}
      >
        <div className="look-stage-aura" />
        <div className="look-stage-orbit orbit-left" />
        <div className="look-stage-orbit orbit-right" />
        <div className="look-stage-floor" />
        <div className="look-stage-mannequin">
          <div className="mannequin-head" />
          <div className="mannequin-body" />
          <div className="mannequin-arm arm-left" />
          <div className="mannequin-arm arm-right" />
          <div className="mannequin-leg leg-left" />
          <div className="mannequin-leg leg-right" />
          {accessory ? <div className={`accessory-anchor ${accessoryMount}`} /> : null}
        </div>
        {dress ? renderStageLayer(dress, 'layer-dress', '连衣裙', 'dress') : null}
        {!dress ? renderStageLayer(bottom, 'layer-bottom', '下装', 'bottom') : null}
        {!dress ? renderStageLayer(top, 'layer-top', '上衣', 'top') : null}
        {outerwear ? renderStageLayer(outerwear, 'layer-outerwear', '外套', 'outerwear') : null}
        {shoes ? renderStageLayer(shoes, 'layer-shoes', '鞋子', 'shoes') : null}
        {accessory ? renderStageLayer(accessory, 'layer-accessory', '配饰', 'accessory') : null}
      </div>
    )
  }

  const renderLookCard = (look: RecommendationLook, eyebrow: string, compact = false, interactive = false) => {
    const hasOuterwear = look.items.some((entry) => entry.item.category === 'outerwear')
    const hasAccessory = look.items.some((entry) => entry.item.category === 'accessory')
    const practicalItems = look.items.filter((entry) => entry.item.category !== 'accessory')
    const recommendationPulse = look.scores.total >= 90 ? '直接穿很稳' : look.scores.total >= 82 ? '稍微确认下就能出门' : '建议看一眼替换项'
    const primaryDecision =
      look.scores.total >= 90 ? '这套现在就能出门。' : look.scores.total >= 82 ? '这套已经很接近最优，可以直接穿。' : '先看一眼换单件，通常还能再顺一点。'
    const decisionPoints = [
      `现在重点：${look.summary}`,
      hasOuterwear ? '带一件外套会更稳妥' : '整套可以直接出门',
      hasAccessory ? '配饰已经帮你补完整体感' : '这套以清爽稳定为主',
    ]

    return (
      <article className={`look-card${compact ? ' compact' : ''}`}>
        <div className="look-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{styleLabels[look.style]}风</h2>
          </div>
          <div className="score-pill">{look.scores.total} 分</div>
        </div>

        <div className={`look-showcase${compact ? ' compact' : ''}`}>
          <div className="look-stage-wrap">
            {renderLookStage(look, compact)}
            <div className="look-stage-note">
              <div className="look-stage-note-top">
                <span className="chip">{sceneLabels[scene]}</span>
                <span className="chip">体感 {forecastWeather.feelsLike}°C</span>
                <span className="chip">{recommendationPulse}</span>
              </div>
              <strong>{look.summary}</strong>
              <p>{look.reasons[0]}</p>
            </div>
          </div>
          <div className="look-brief">
            {interactive ? (
              <div className="decision-bar">
                <div className="decision-bar-copy">
                  <strong>{primaryDecision}</strong>
                  <span>{replaceCategory ? '你现在正在看微调模式，点“微调单件”就能收起。' : '先看整套结论，如果客户想细调，再微调单件就行。'}</span>
                </div>
                <div className="decision-bar-actions">
                  <button className="primary" onClick={handleWearLook}>
                    穿这套
                  </button>
                  <button className="secondary" onClick={handleRefreshLook}>
                    再看一套
                  </button>
                  <button className={`ghost${replaceCategory ? ' active-soft' : ''}`} onClick={() => setReplaceCategory(replaceCategory ? null : 'shoes')}>
                    微调单件
                  </button>
                </div>
              </div>
            ) : null}

            <div className="look-brief-copy">
              <strong>今天主推就按这套来</strong>
              <p>先给客户看整套效果，再快速确认每件单品，演示节奏会更顺。</p>
            </div>

            <div className="look-metrics">
              <div className="look-metric-card">
                <span>天气适配</span>
                <strong>{look.scores.weather}</strong>
              </div>
              <div className="look-metric-card">
                <span>风格稳定</span>
                <strong>{look.scores.style}</strong>
              </div>
              <div className="look-metric-card">
                <span>实穿单品</span>
                <strong>{practicalItems.length} 件</strong>
              </div>
            </div>

            <div className="decision-strip">
              {decisionPoints.map((point) => (
                <div className="decision-pill" key={point}>
                  {point}
                </div>
              ))}
            </div>

            <div className={`item-grid condensed${compact ? ' compact' : ''}`}>
              {look.items.map(({ item }) => (
                <div className="item-card condensed" key={item.id}>
                  <div className="item-card-top">
                    {renderItemVisual(item)}
                    <div className="item-copy">
                      <strong>{item.name}</strong>
                      <p>
                        {categoryLabels[item.category]} / {styleLabels[item.style]}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {interactive ? (
              <div className="look-cta-panel">
                <div className="look-cta-grid">
                  <button className="ghost" onClick={handleFavoriteLook}>
                    收藏
                  </button>
                  <button className="ghost" onClick={() => setActiveTab('wardrobe')}>
                    去衣橱看单品
                  </button>
                </div>
                <p className="look-cta-tip">上面那排按钮负责快速决定，这里保留收藏和回看单品入口。</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="reasons highlight-reasons">
          {look.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      </article>
    )
  }

  const renderReplacePreview = (baseLook: RecommendationLook, nextLook: RecommendationLook, category: ReplaceCategory) => {
    const currentItem = baseLook.items.find((entry) => entry.item.category === category)?.item
    const nextItem = nextLook.items.find((entry) => entry.item.category === category)?.item
    if (!currentItem || !nextItem) return null

    return (
      <div className="replace-preview-card">
        <div className="replace-preview-flow">
          <div className="replace-preview-item">
            {renderItemVisual(currentItem)}
            <strong>{currentItem.name}</strong>
            <p>当前这件</p>
          </div>
          <div className="replace-preview-arrow">→</div>
          <div className="replace-preview-item next">
            {renderItemVisual(nextItem)}
            <strong>{nextItem.name}</strong>
            <p>建议替换</p>
          </div>
        </div>

        <div className="replace-preview-copy">
          <strong>只替换这一个位置</strong>
          <p>整套风格、天气适配和其他单品都尽量保持不变，只把这一件调得更顺一点。</p>
        </div>

        <button className="secondary" onClick={() => applyReplacement(nextLook)}>
          用这件替换
        </button>
      </div>
    )
  }

  const renderSavedLookSection = () => (
    <article className="settings-card wide-card">
      <div className="saved-panel-head">
        <div>
          <h3>{savedSection === 'history' ? '最近穿搭' : '收藏搭配'}</h3>
          <p>
            {savedSection === 'history'
              ? '穿过并确认过的搭配会留在这里，方便你快速重穿。'
              : '真正顺手的搭配先收藏，忙的时候可以直接调出来。'}
          </p>
        </div>
        <div className="saved-summary">
          <strong>{filteredSavedLooks.length}</strong>
          <span>{savedSection === 'history' ? '条结果' : '条收藏'}</span>
        </div>
      </div>

      <div className="toggle-list saved-toggle">
        <button className={savedSection === 'history' ? 'active' : ''} onClick={() => setSavedSection('history')}>
          最近穿搭
        </button>
        <button className={savedSection === 'favorite' ? 'active' : ''} onClick={() => setSavedSection('favorite')}>
          收藏搭配
        </button>
      </div>

      <div className="saved-filter-row">
        <button className={savedStyleFilter === 'all' ? 'active' : ''} onClick={() => setSavedStyleFilter('all')}>
          全部
        </button>
        {Object.entries(styleLabels).map(([value, label]) => (
          <button
            key={value}
            className={savedStyleFilter === value ? 'active' : ''}
            onClick={() => setSavedStyleFilter(value as SavedStyleFilter)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="saved-look-list">
        {filteredSavedLooks.map((entry) => (
          <div key={entry.id} className="saved-look-row">
            <button
              className="saved-look-card"
              onClick={() => {
                setCustomLook(entry.look)
                setActiveTab('home')
                setFeedback(savedSection === 'history' ? '这套已经替你调回首页，可以直接再穿。' : '收藏搭配已经调回首页，直接继续用就行。')
              }}
            >
              <div className="saved-look-topline">
                <strong>{styleLabels[entry.look.style]}风</strong>
                <span>{formatSavedDate(entry.createdAt)}</span>
              </div>
              {renderLookStage(entry.look, true)}
              <span>{entry.look.summary}</span>
              <span>{entry.look.items.map((item) => item.item.name).slice(0, 3).join(' / ')}</span>
            </button>

            {savedSection === 'favorite' ? (
              <button className="ghost danger" onClick={() => handleRemoveFavorite(entry.id)}>
                取消收藏
              </button>
            ) : (
              <button
                className="ghost"
                onClick={() => {
                  setCustomLook(entry.look)
                  setActiveTab('home')
                  setFeedback('这套已经回到首页，可以直接作为今天的参考。')
                }}
              >
                再看这套
              </button>
            )}
          </div>
        ))}

        {filteredSavedLooks.length === 0 ? (
          <p>{savedSection === 'history' ? '当前筛选下还没有穿搭记录。' : '当前筛选下还没有收藏搭配。'}</p>
        ) : null}
      </div>
    </article>
  )

  if (authChecking) {
    return (
      <div className="shell auth-shell">
        <div className="auth-card">
          <p className="brand">智能衣橱</p>
          <h1>正在恢复你的手机端会话</h1>
          <p>如果你之前已经登录过，这里会直接回到你的个人衣橱。</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="shell auth-shell">
        <form className="auth-card" onSubmit={handleVerifyCode}>
          <p className="brand">智能衣橱</p>
          <h1>先登录，再把你的穿搭数据留住</h1>
          <p className="auth-copy">现在是手机优先版本，登录后你的衣橱、偏好和穿着记录都会按手机号分开保存。</p>

          <label>
            <span>手机号</span>
            <input
              value={loginForm.phone}
              inputMode="numeric"
              maxLength={11}
              onChange={(event) => setLoginForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '') }))}
              placeholder="请输入 11 位手机号"
            />
          </label>

          <div className="auth-code-row">
            <label>
              <span>验证码</span>
              <input
                value={loginForm.code}
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setLoginForm((current) => ({ ...current, code: event.target.value.replace(/\D/g, '') }))}
                placeholder="输入验证码"
              />
            </label>
            <button type="button" className="ghost" onClick={handleRequestCode} disabled={loginLoading}>
              获取验证码
            </button>
          </div>

          <div className="auth-helper">
            <strong>登录提示</strong>
            <p>{loginMessage}</p>
          </div>

          <button className="primary" type="submit" disabled={loginLoading}>
            {loginLoading ? '处理中…' : '登录进入衣橱'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="brand">智能衣橱</p>
          <h1>看天气，懂你衣橱，今天直接穿这套</h1>
        </div>
        <div className="topbar-actions">
          <label className="select-field">
            <span>所在城市</span>
            <select value={selectedCity} onChange={(event) => updateCity(event.target.value)}>
              {cityList.map((item) => (
                <option key={item.city} value={item.city}>
                  {item.city}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {apiMessage ? <div className="api-banner">{apiMessage}</div> : null}

      <main className="content">
        {bootstrapLoading ? (
          <section className="page">
            <div className="empty-block">
              <h2>正在准备你的今日推荐</h2>
              <p>衣橱、收藏和历史记录马上就好。</p>
            </div>

            <div className="wardrobe-summary-row" hidden>
              <div className="metric-card">
                <strong>{wardrobeSummary.total}</strong>
                <span>当前筛选</span>
              </div>
              <div className="metric-card">
                <strong>{wardrobeSummary.topCount}</strong>
                <span>上衣</span>
              </div>
              <div className="metric-card">
                <strong>{wardrobeSummary.shoesCount}</strong>
                <span>鞋子</span>
              </div>
              <div className="metric-card">
                <strong>{wardrobeSummary.recentCount}</strong>
                <span>有穿着记录</span>
              </div>
            </div>
          </section>
        ) : null}

        {!bootstrapLoading && activeTab === 'home' ? (
          <section className="page">
            <div className="weather-panel">
              <div className="weather-top">
                <div>
                  <p className="eyebrow">{forecastDayLabels[forecastDay]} {dayPartLabels[dayPart]}</p>
                  <h2>
                    {forecastWeather.city}
                    <span>{getWeatherLabel(forecastWeather.weatherType)}</span>
                  </h2>
                </div>
                <div className="weather-live">
                  <span className={weatherLoading ? 'status loading' : 'status'}>
                    {weatherLoading ? '天气更新中…' : `${forecastWeather.temperature}°C`}
                  </span>
                </div>
              </div>
              <div className="forecast-toolbar">
                <div className="forecast-switch" aria-label="推荐日期">
                  {Object.entries(forecastDayLabels).map(([value, label]) => (
                    <button
                      key={value}
                      className={forecastDay === value ? 'active' : ''}
                      onClick={() => setForecastDay(value as ForecastDay)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="forecast-switch" aria-label="推荐时段">
                  {Object.entries(dayPartLabels).map(([value, label]) => (
                    <button key={value} className={dayPart === value ? 'active' : ''} onClick={() => setDayPart(value as DayPart)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="weather-stats">
                <span>体感 {forecastWeather.feelsLike}°C</span>
                <span>温差 {forecastWeather.tempGap}°C</span>
                <span>降雨 {forecastWeather.rainProbability}%</span>
                <span>湿度 {forecastWeather.humidity}%</span>
              </div>
              <p className="weather-tip">{buildForecastTip(forecastWeather, forecastDay, dayPart)}</p>
              {weatherError ? <p className="weather-error">{weatherError}</p> : null}
            </div>

            <section className="scene-strip" aria-label="快捷切换场景">
              {Object.entries(sceneLabels).map(([value, label]) => (
                <button key={value} className={scene === value ? 'active' : ''} onClick={() => setScene(value as Scene)}>
                  {label}
                </button>
              ))}
            </section>

            {currentLook ? (
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
                      <p>{sceneLabels[scene]} / {forecastDayLabels[forecastDay]} {dayPartLabels[dayPart]}</p>
                    </div>
                    <div className="home-summary-block">
                      <strong>推荐重点</strong>
                      <p>{currentLook.reasons[0] ?? '这套是当前天气和偏好下最稳妥的主推方案。'}</p>
                    </div>
                  </div>
                </section>

                {renderLookCard(currentLook, `${forecastDayLabels[forecastDay]}${dayPartLabels[dayPart]}推荐`, false, true)}

                {replaceCategory ? (
                  <section className="replace-panel">
                    <div className="replace-header">
                      <h3>微调这一套</h3>
                      <p>不重算整套，只换掉客户最想调整的那一个位置。</p>
                      <div className="replace-types">
                        {(['top', 'bottom', 'shoes', 'outerwear', 'accessory'] as ReplaceCategory[]).map((type) => (
                          <button
                            key={type}
                            className={replaceCategory === type ? 'active' : ''}
                            onClick={() => setReplaceCategory(type)}
                          >
                            {categoryLabels[type]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {replacementOptions.length > 0 ? (
                      <div className="replacement-option">
                        {renderReplacePreview(currentLook, replacementOptions[0], replaceCategory)}
                        <div className="replacement-look-compact">{renderLookCard(replacementOptions[0], '替换后效果', true)}</div>
                      </div>
                    ) : (
                      <p className="weather-tip">当前这个品类没有更稳妥的替换项了。</p>
                    )}
                  </section>
                ) : null}

                {alternativeLooks.length > 0 ? (
                  <section className="decision-queue">
                    <div className="section-head compact-head">
                      <h3>备选方案</h3>
                      <p>如果客户想看第二种方向，直接从下面切过去就行。</p>
                    </div>
                    <div className="decision-queue-grid">
                      {alternativeLooks.map((look) => (
                        <button
                          key={look.id}
                          className="decision-queue-card"
                          onClick={() => {
                            setCustomLook(null)
                            const nextIndex = recommendations.findIndex((entry) => entry.id === look.id)
                            if (nextIndex >= 0) setRecommendationIndex(nextIndex)
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
                          <p>{look.summary}</p>
                          <small>{look.reasons[0]}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <div className="empty-block">
                <h2>当前还没有可推荐的整套穿搭</h2>
                <p>先去录入几件常穿的上衣、下装和鞋子，系统就能开始给你推荐。</p>
              </div>
            )}

            <div className="feedback-bar">{feedback}</div>
          </section>
        ) : null}

        {!bootstrapLoading && activeTab === 'wardrobe' ? (
          <section className="page">
            <div className="section-head">
              <h2>衣橱管理</h2>
              <p>把常穿单品整理顺手，后面每天出门前就能更快拿到稳妥推荐。</p>
            </div>

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
                      onClick={() => setFilters((current) => ({ ...current, category: value }))}
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
                      onClick={() => setFilters((current) => ({ ...current, style: value }))}
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
                      onClick={() => setFilters((current) => ({ ...current, colorGroup: value }))}
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

            <div className="wardrobe-summary-row">
              <div className="metric-card">
                <strong>{wardrobeSummary.total}</strong>
                <span>当前筛选</span>
              </div>
              <div className="metric-card">
                <strong>{wardrobeSummary.topCount}</strong>
                <span>上衣</span>
              </div>
              <div className="metric-card">
                <strong>{wardrobeSummary.shoesCount}</strong>
                <span>鞋子</span>
              </div>
              <div className="metric-card">
                <strong>{wardrobeSummary.recentCount}</strong>
                <span>有穿着记录</span>
              </div>
            </div>

            <div className="wardrobe-quick-row">
              {Object.entries(wardrobeQuickFilterLabels).map(([value, label]) => (
                <button
                  key={value}
                  className={wardrobeQuickFilter === value ? 'active' : ''}
                  onClick={() => setWardrobeQuickFilter(value as WardrobeQuickFilter)}
                >
                  {label}
                </button>
              ))}
            </div>

            {wardrobeEdit && editingWardrobeItem ? (
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
                    {subjectCutEnabled ? <small className="preview-note">棋盘底纹用于检查透明背景；如果仍看到完整白底矩形，说明这张图还没有真正提取出主体。</small> : null}

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
                          <strong>换图后的建议标签</strong>
                          <p>{editSmartDraft.note}</p>
                        </div>
                        {editSmartDraft.source === 'local' ? <small className="draft-warning">这一步还是本地粗略判断，建议你手动确认品类后再保存。</small> : null}
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
                      <input
                        value={wardrobeEdit.name}
                        onChange={(event) => setWardrobeEdit((current) => (current ? { ...current, name: event.target.value } : current))}
                      />
                    </label>

                    <label>
                      <span>品类</span>
                      <select hidden
                        value={wardrobeEdit.category}
                        onChange={(event) =>
                          setWardrobeEdit((current) =>
                            current ? { ...current, category: event.target.value as ClothingCategory } : current,
                          )
                        }
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
                        onChange={(event) =>
                          setWardrobeEdit((current) =>
                            current ? { ...current, colorGroup: event.target.value as ColorGroup } : current,
                          )
                        }
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
                        onChange={(event) =>
                          setWardrobeEdit((current) =>
                            current ? { ...current, thickness: event.target.value as Thickness } : current,
                          )
                        }
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
                        onChange={(event) =>
                          setWardrobeEdit((current) =>
                            current ? { ...current, style: event.target.value as StyleTag } : current,
                          )
                        }
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
                        onChange={(event) =>
                          setWardrobeEdit((current) =>
                            current ? { ...current, seasonFit: event.target.value as SeasonFit } : current,
                          )
                        }
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
                        onChange={(event) =>
                          setWardrobeEdit((current) =>
                            current ? { ...current, fitType: event.target.value as FitType } : current,
                          )
                        }
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
                        onChange={(event) =>
                          setWardrobeEdit((current) =>
                            current ? { ...current, garmentLength: event.target.value as GarmentLength } : current,
                          )
                        }
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
                        onChange={(event) =>
                          setWardrobeEdit((current) =>
                            current ? { ...current, sleeveLength: event.target.value as SleeveLength } : current,
                          )
                        }
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
                        onChange={(event) =>
                          setWardrobeEdit((current) =>
                            current ? { ...current, silhouette: event.target.value as Silhouette } : current,
                          )
                        }
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
                  <button
                    className="ghost"
                    onClick={() => {
                      setWardrobeEdit(null)
                      setEditRawImageUrl('')
                      setEditImagePreset('studio')
                      setEditImageHint('换图后也会继续自动整理成更干净的单品卡片。')
                    }}
                  >
                    先不改了
                  </button>
                </div>
              </article>
            ) : null}

            {focusedWardrobeItem ? (
              <article className="settings-card wardrobe-detail-card">
                <div className="section-head">
                  <div>
                    <h3>{focusedWardrobeItem.name}</h3>
                    <p>先确认这件衣服的状态和标签，再决定要不要继续修改。</p>
                  </div>
                  <button className="ghost" onClick={() => setWardrobeFocusId(null)}>
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
                      <button className="primary" onClick={() => openWardrobeEditor(focusedWardrobeItem)}>
                        {wardrobeEdit?.id === focusedWardrobeItem.id ? '继续编辑这件' : '编辑这件'}
                      </button>
                      <button className="ghost danger" onClick={() => handleDeleteItem(focusedWardrobeItem.id)}>
                        删除这件
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ) : null}

            <div className="wardrobe-grid">
              {filteredWardrobe.map((item) => (
                <article className="wardrobe-card" key={item.id}>
                  {renderItemVisual(item)}
                  <div className="wardrobe-copy">
                    <strong>{item.name}</strong>
                    <p>
                      {styleLabels[item.style]} / {thicknessLabels[item.thickness]} / {seasonLabels[item.seasonFit]}
                    </p>
                    <small>
                      穿过 {item.wearCount} 次{item.lastWornAt ? ` / 最近 ${item.lastWornAt}` : ''}
                    </small>
                  </div>
                  <button className="ghost" onClick={() => setWardrobeFocusId(item.id)}>
                    详情
                  </button>
                  <button className="ghost" onClick={() => openWardrobeEditor(item)}>
                    编辑
                  </button>
                  <button className="ghost danger" onClick={() => handleDeleteItem(item.id)}>
                    删除
                  </button>
                </article>
              ))}
            </div>
            {filteredWardrobe.length === 0 ? (
              <div className="empty-block">
                <h2>当前筛选下还没有衣物</h2>
                <p>可以换个筛选条件，或者先去录入几件常穿单品，推荐才会越来越稳。</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {!bootstrapLoading && activeTab === 'add' ? (
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
                    onClick={() => openAddIntake(mode)}
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
                <input accept="image/*" capture="environment" type="file" multiple onChange={handleImageUpload} />
                <div className="preview-toolbar">
                  <div className="preview-status">
                    <strong>{currentPreviewMethod ? getCutoutMethodLabel(currentPreviewMethod) : '等待上传'}</strong>
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
                <div className={`upload-preview ${subjectCutEnabled ? 'subject-preview' : ''} preview-backdrop-${previewBackdrop}`}>
                  {addForm.imageUrl ? <img src={addForm.imageUrl} alt="衣物预览" /> : <p>上传后会直接显示在首页推荐卡和衣橱列表里。</p>}
                </div>
                {subjectCutEnabled ? (
                  <small className="preview-note">
                    棋盘底纹适合看透明区，深色底更适合查浅色衣服边缘，暖底更容易看出是否还残留灰雾。
                  </small>
                ) : null}
              </label>

              <div className="upload-helper">
                <strong>{imagePreparing ? '正在处理图片…' : '图片录入提示'}</strong>
                <p>{imageHint}</p>
              </div>

              {batchExtractionTotal > 1 ? (
                <div className="batch-progress-card">
                  <div className="batch-progress-copy">
                    <strong>
                      批量提取进度 {batchExtractionCompleted}/{batchExtractionTotal}
                    </strong>
                    <span>{imagePreparing && batchExtractionCurrentName ? `正在处理：${batchExtractionCurrentName}` : '这批结果会保留在下面，点任意一张即可切回继续录入。'}</span>
                  </div>
                  <div className="batch-progress-track" aria-hidden="true">
                    <div className="batch-progress-fill" style={{ width: `${batchExtractionProgress}%` }} />
                  </div>
                </div>
              ) : null}

              {batchExtractionItems.length > 1 ? (
                <div className="batch-panel">
                  <div className="section-head compact-head">
                    <h3>批量提取结果</h3>
                    <p>可以逐张点开检查，当前表单会切换到你选中的那张。</p>
                  </div>
                  <div className="inline-image-actions">
                    <button type="button" className="ghost" onClick={clearBatchExtraction}>
                      清空这批结果
                    </button>
                  </div>
                  <div className="batch-grid">
                    {batchExtractionItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`batch-card${batchExtractionSelectedId === item.id ? ' active' : ''}${item.status === 'error' ? ' error' : ''}`}
                        onClick={() => applyBatchExtractionItem(item)}
                        disabled={item.status !== 'done'}
                      >
                        <div className="batch-thumb">
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.fileName} /> : <span>失败</span>}
                        </div>
                        <strong>{item.fileName}</strong>
                        <small>{item.status === 'done' ? (item.extracted ? '主体已提取' : '保留原图') : item.errorMessage}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {canQuickConfirmAdd ? (
                <div className="quick-confirm-card">
                  <div className="quick-confirm-copy">
                    <strong>这张图已经可以直接入衣橱</strong>
                    <p>主体、名称和主要标签都已经准备好。赶时间时直接确认保存，之后再慢慢微调也行。</p>
                  </div>
                  <div className="chip-row">
                    <span className="chip">{addForm.name}</span>
                    <span className="chip">{categoryLabels[addForm.category]}</span>
                    <span className="chip">{colorLabels[addForm.colorGroup]}</span>
                    <span className="chip">{styleLabels[addForm.style]}</span>
                  </div>
                  <div className="quick-confirm-actions">
                    <button className="primary" type="submit" disabled={itemSaving || imagePreparing}>
                      {itemSaving ? '保存中…' : '确认加入衣橱'}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        document.getElementById('add-item-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        setFeedback('这张图已经够用了，如果你想更细调标签，直接往下改就行。')
                      }}
                    >
                      再改细一点
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="subject-mode-card">
                <div>
                  <strong>自动分离背景与主体</strong>
                  <p>默认开启。保存上传时会尽量把衣服主体提出来，让单品图更像干净卡片。</p>
                </div>
                <button
                  type="button"
                  className={subjectCutEnabled ? 'secondary' : 'ghost'}
                  onClick={() => setSubjectCutEnabled((current) => !current)}
                >
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

                  {smartDraft ? (
                      <div className="smart-draft">
                        <div>
                          <strong>智能建议</strong>
                          <p>{smartDraft.note}</p>
                        </div>
                      {smartDraft.source === 'local' ? <small className="draft-warning">这一步还是本地粗略判断，建议你手动确认品类后再保存。</small> : null}
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
                      <button type="button" className="secondary" onClick={applySmartDraft}>
                        一键套用建议
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}

              <label>
                <span>衣物名称</span>
                <input
                  value={addForm.name}
                  onChange={(event) => setAddForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="例如：奶油白短袖衬衫"
                />
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
            </form>

            <div className="mobile-tip-card">
              <h3>手机上这样录更省事</h3>
              <p>现在拍完照后不只可以直接裁图，还能一键套用颜色、风格和厚薄建议。</p>
            </div>
          </section>
        ) : null}

        {!bootstrapLoading && activeTab === 'tryon' ? (
          <section className="page profile-page">
            <div className="section-head">
              <h2>试穿预览</h2>
              <p>先把参考照和单品整理好，展示上身效果会更顺。</p>
            </div>

            <div className="profile-grid">
              <article className="settings-card">
                <div className="settings-card-head">
                  <div>
                    <h3>创建试穿任务</h3>
                    <p>用你的参考照搭配一件整理好的单品，先快速生成一条预览任务。</p>
                  </div>
                  <button
                    className="secondary"
                    type="button"
                    onClick={handleCreateTryOnSession}
                    disabled={!tryOnReadiness.canStartPreview || !selectedTryOnItemId || tryOnCreating}
                  >
                    {tryOnCreating ? '创建中…' : '创建任务'}
                  </button>
                </div>

                <div className="try-on-setup-grid">
                  <div className="try-on-setup-pane">
                    <strong>本人参考照</strong>
                    <div className="try-on-photo-preview">
                      {avatarProfile.tryOnPhotoUrl ? (
                        <img src={avatarProfile.tryOnPhotoUrl} alt="本人试穿参考照" />
                      ) : (
                        <span>先去“我的”里上传参考照</span>
                      )}
                    </div>
                  </div>

                  <div className="try-on-setup-pane">
                    <strong>当前选中的单品</strong>
                    {selectedTryOnItem ? (
                      <div className="try-on-selected-card">
                        {renderItemVisual(selectedTryOnItem)}
                        <div className="item-copy">
                          <strong>{selectedTryOnItem.name}</strong>
                          <p>
                            {categoryLabels[selectedTryOnItem.category]} / {garmentLengthLabels[selectedTryOnItem.garmentLength ?? 'regular']} /{' '}
                            {silhouetteLabels[selectedTryOnItem.silhouette ?? 'straight']}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-inline">先录入至少一件带图片的上衣、下装或裙装。</div>
                    )}
                  </div>
                </div>

                <label>
                  <span>选择试穿单品</span>
                  <select value={selectedTryOnItemId} onChange={(event) => setSelectedTryOnItemId(event.target.value)}>
                    {tryOnReadyItems.length === 0 ? (
                      <option value="">暂无可试穿单品</option>
                    ) : (
                      tryOnReadyItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} / {categoryLabels[item.category]}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <div className="avatar-profile-summary">
                  <span>{tryOnReadiness.hasTryOnPhoto ? '本人照已准备' : '缺少本人照'}</span>
                  <span>{tryOnReadiness.readyCount} 件可试穿单品</span>
                  <span>{tryOnReadiness.canStartPreview ? '可以开始接模型' : '建议再补单品或参考照'}</span>
                </div>
              </article>

              <article className="settings-card wide-card">
                <div className="settings-card-head">
                  <div>
                    <h3>试穿任务记录</h3>
                    <p>现在先记录素材就绪状态，后面接入生成服务后可以直接把结果回写到这些任务里。</p>
                  </div>
                  <span className={`readiness-pill${tryOnSessions.length > 0 ? ' ready' : ''}`}>{tryOnSessions.length} 条任务</span>
                </div>

                <div className="saved-filter-row">
                  {Object.entries(tryOnStatusFilterLabels).map(([value, label]) => (
                    <button
                      key={value}
                      className={tryOnStatusFilter === value ? 'active' : ''}
                      onClick={() => setTryOnStatusFilter(value as TryOnStatusFilter)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="try-on-session-list">
                  {filteredTryOnSessions.map((entry) => {
                    const garment = wardrobe.find((item) => item.id === entry.garmentItemId)
                    return (
                      <article className="try-on-session-card" key={entry.id}>
                        <div className="try-on-session-grid">
                          <div className="try-on-session-preview">
                            <div className="try-on-photo-preview compact">
                              <img src={entry.personImageUrl} alt="本人参考照" />
                            </div>
                            <div className="try-on-session-plus">+</div>
                            <div className="item-visual tone-black_white_gray category-top">
                              <img src={entry.garmentImageUrl} alt={garment?.name ?? '试穿单品'} />
                            </div>
                          </div>

                          <div className="try-on-session-copy">
                            <div className="saved-look-topline">
                              <strong>{garment?.name ?? '试穿单品'}</strong>
                              <span>{formatSavedDate(entry.createdAt)}</span>
                            </div>
                            <div className="avatar-profile-summary compact-summary">
                              <span>{getTryOnStatusLabel(entry.status)}</span>
                              <span>{getTryOnProviderLabel(entry.provider)}</span>
                              <span>{garment ? categoryLabels[garment.category] : '单品'}</span>
                            </div>
                            <p>{entry.note}</p>
                            {entry.resultImageUrl ? (
                              <div className="try-on-result-preview">
                                <img src={entry.resultImageUrl} alt={`${garment?.name ?? '试穿单品'} 试穿结果`} />
                              </div>
                            ) : null}
                            <div className="try-on-session-actions">
                              {entry.resultImageUrl ? (
                                <button className="ghost" type="button" onClick={() => setPreviewingTryOnSession(entry)}>
                                  查看大图
                                </button>
                              ) : null}
                              <button
                                className="secondary"
                                type="button"
                                onClick={() => handleCreateMockPreview(entry.id)}
                                disabled={tryOnPreviewingId === entry.id}
                              >
                                {tryOnPreviewingId === entry.id ? '生成中…' : entry.resultImageUrl ? '重新生成预览' : '生成试穿预览'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                  {filteredTryOnSessions.length === 0 ? (
                    <div className="empty-block">
                      <h2>{tryOnSessions.length === 0 ? '还没有试穿任务' : '当前筛选下没有任务'}</h2>
                      <p>
                        {tryOnSessions.length === 0
                          ? '上传本人参考照后，选一件已经整理好的单品，先创建第一条任务就行。'
                          : '换一个状态筛选试试，或者继续生成新的试穿任务。'}
                      </p>
                    </div>
                  ) : null}
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {!bootstrapLoading && activeTab === 'profile' ? (
          <section className="page profile-page">
            <div className="section-head">
              <h2>偏好设置</h2>
              <p>这里每改一项，首页推荐都会跟着更新。</p>
            </div>

            <div className="profile-grid">
              <article className="settings-card">
                <h3>喜欢的风格</h3>
                <div className="toggle-list">
                  {Object.entries(styleLabels).map(([value, label]) => {
                    const typedValue = value as StyleTag
                    const active = preferences.preferredStyles.includes(typedValue)
                    return (
                      <button
                        key={value}
                        className={active ? 'active' : ''}
                        onClick={() =>
                          updatePreferences({
                            ...preferences,
                            preferredStyles: active
                              ? preferences.preferredStyles.filter((entry) => entry !== typedValue)
                              : [...preferences.preferredStyles, typedValue].slice(-3),
                          })
                        }
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </article>

              <article className="settings-card">
                <h3>舒适优先项</h3>
                <select
                  value={preferences.comfortPriority}
                  onChange={(event) =>
                    updatePreferences({
                      ...preferences,
                      comfortPriority: event.target.value as ComfortPriority,
                    })
                  }
                >
                  {Object.entries(comfortOptions).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </article>

              <article className="settings-card">
                <h3>默认场景</h3>
                <select
                  value={preferences.defaultScene}
                  onChange={(event) => {
                    const nextScene = event.target.value as Scene
                    updatePreferences({ ...preferences, defaultScene: nextScene })
                    setScene(nextScene)
                  }}
                >
                  {Object.entries(sceneLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </article>

              <article className="settings-card">
                <h3>推荐设置</h3>
                <div className="checkbox-list">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.acceptsLayering}
                      onChange={(event) =>
                        updatePreferences({
                          ...preferences,
                          acceptsLayering: event.target.checked,
                        })
                      }
                    />
                    接受叠穿
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.avoidRepeatLooks}
                      onChange={(event) =>
                        updatePreferences({
                          ...preferences,
                          avoidRepeatLooks: event.target.checked,
                        })
                      }
                    />
                    尽量避免重复推荐
                  </label>
                </div>
              </article>

              <article className="settings-card">
                <div className="settings-card-head">
                  <div>
                    <h3>我的身材档案</h3>
                    <p>先把基础体型填完整，后续推荐和展示都会更贴近你。</p>
                  </div>
                  <button className="secondary" type="button" onClick={handleSaveAvatarProfile} disabled={avatarSaving}>
                    {avatarSaving ? '保存中…' : '保存档案'}
                  </button>
                </div>

                <input id="try-on-photo-input" hidden accept="image/*" type="file" onChange={handleTryOnPhotoUpload} />

                <div className="try-on-photo-card">
                  <div className="try-on-photo-copy">
                    <strong>本人试穿参考照</strong>
                    <p>建议上传一张正面、站姿自然、背景尽量干净的全身照，后面接试衣会更稳。</p>
                  </div>
                  <div className="try-on-photo-preview">
                    {avatarProfile.tryOnPhotoUrl ? (
                      <img src={avatarProfile.tryOnPhotoUrl} alt="试穿参考照" />
                    ) : (
                      <span>还没有上传试穿参考照</span>
                    )}
                  </div>
                  <button className="ghost" type="button" onClick={openTryOnPhotoPicker} disabled={avatarPhotoUploading}>
                    {avatarPhotoUploading ? '上传中…' : avatarProfile.tryOnPhotoUrl ? '更换参考照' : '上传参考照'}
                  </button>
                </div>

                <div className="avatar-profile-grid">
                  <label>
                    <span>身高（cm）</span>
                    <input
                      type="number"
                      min={130}
                      max={220}
                      value={avatarProfile.heightCm}
                      onChange={(event) => updateAvatarField('heightCm', Number(event.target.value || 0))}
                    />
                  </label>

                  <label>
                    <span>体重（kg）</span>
                    <input
                      type="number"
                      min={30}
                      max={180}
                      value={avatarProfile.weightKg}
                      onChange={(event) => updateAvatarField('weightKg', Number(event.target.value || 0))}
                    />
                  </label>

                  <label>
                    <span>风格呈现</span>
                    <select
                      value={avatarProfile.genderPresentation}
                      onChange={(event) => updateAvatarField('genderPresentation', event.target.value as GenderPresentation)}
                    >
                      {Object.entries(genderPresentationLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>整体身形</span>
                    <select value={avatarProfile.bodyShape} onChange={(event) => updateAvatarField('bodyShape', event.target.value as BodyShape)}>
                      {Object.entries(bodyShapeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>肩部观感</span>
                    <select value={avatarProfile.shoulderType} onChange={(event) => updateAvatarField('shoulderType', event.target.value as ShoulderType)}>
                      {Object.entries(shoulderTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>腰线观感</span>
                    <select value={avatarProfile.waistType} onChange={(event) => updateAvatarField('waistType', event.target.value as WaistType)}>
                      {Object.entries(waistTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>胯臀观感</span>
                    <select value={avatarProfile.hipType} onChange={(event) => updateAvatarField('hipType', event.target.value as HipType)}>
                      {Object.entries(hipTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>腿长比例</span>
                    <select value={avatarProfile.legLengthType} onChange={(event) => updateAvatarField('legLengthType', event.target.value as LegLengthType)}>
                      {Object.entries(legLengthLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="avatar-profile-summary">
                  <span>{avatarProfile.heightCm} cm / {avatarProfile.weightKg} kg</span>
                  <span>{bodyShapeLabels[avatarProfile.bodyShape]}</span>
                  <span>{shoulderTypeLabels[avatarProfile.shoulderType]}肩</span>
                  <span>{waistTypeLabels[avatarProfile.waistType]}腰线</span>
                  <span>{hipTypeLabels[avatarProfile.hipType]}胯臀</span>
                </div>
              </article>

              <article className="settings-card">
                <div className="settings-card-head">
                  <div>
                    <h3>试穿准备度</h3>
                    <p>
                      {tryOnReadiness.canStartPreview
                        ? '基础素材已经够用了，可以直接开始生成预览。'
                        : '再补一点素材，就能更顺手地看上身效果。'}
                    </p>
                  </div>
                  <span className={`readiness-pill${tryOnReadiness.canStartPreview ? ' ready' : ''}`}>
                    {tryOnReadiness.canStartPreview ? '已可开始' : '继续补素材'}
                  </span>
                </div>

                <div className="saved-metrics">
                  <div className="metric-card">
                    <strong>{tryOnReadiness.hasTryOnPhoto ? '已上传' : '未上传'}</strong>
                    <span>本人参考照</span>
                  </div>
                  <div className="metric-card">
                    <strong>{tryOnReadiness.readyCount}</strong>
                    <span>件可试穿单品</span>
                  </div>
                  <div className="metric-card">
                    <strong>{tryOnReadiness.tops + tryOnReadiness.dresses}</strong>
                    <span>上装/裙装</span>
                  </div>
                </div>

                <div className="avatar-profile-summary">
                  <span>上衣 {tryOnReadiness.tops} 件</span>
                  <span>下装 {tryOnReadiness.bottoms} 件</span>
                  <span>连衣裙 {tryOnReadiness.dresses} 件</span>
                  <span>外套 {tryOnReadiness.outerwear} 件</span>
                  <span>鞋子 {tryOnReadiness.shoes} 双</span>
                </div>
              </article>

              <article className="settings-card">
                <h3>当前账号</h3>
                <p>{session.nickname}</p>
                <p>{session.phone}</p>
                <button className="ghost" onClick={handleLogout}>
                  退出登录
                </button>
              </article>

              <article className="settings-card">
                <h3>使用概览</h3>
                <div className="saved-metrics">
                  <div className="metric-card">
                    <strong>{wardrobe.length}</strong>
                    <span>件衣物</span>
                  </div>
                  <div className="metric-card">
                    <strong>{historyLooks.length}</strong>
                    <span>次穿搭记录</span>
                  </div>
                  <div className="metric-card">
                    <strong>{favoriteLooks.length}</strong>
                    <span>套收藏搭配</span>
                  </div>
                </div>
              </article>

              {renderSavedLookSection()}
            </div>
          </section>
        ) : null}
      </main>

      {session ? (
        <nav className="bottom-nav">
          {Object.entries(tabLabels).map(([id, label]) => (
            <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id as TabId)}>
              {label}
            </button>
          ))}
        </nav>
      ) : null}

      {previewingTryOnSession?.resultImageUrl ? (
        <div className="result-lightbox" role="dialog" aria-modal="true" onClick={() => setPreviewingTryOnSession(null)}>
          <div className="result-lightbox-card" onClick={(event) => event.stopPropagation()}>
            <div className="settings-card-head">
              <div>
                <h3>试穿结果大图</h3>
                <p>{previewingTryOnSession.note}</p>
              </div>
              <button className="ghost" type="button" onClick={() => setPreviewingTryOnSession(null)}>
                关闭
              </button>
            </div>
            <div className="result-lightbox-image">
              <img src={previewingTryOnSession.resultImageUrl} alt="试穿结果大图" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App

