import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import './App.css'
import { AddItemPanel } from './components/AddItemPanel'
import { HomeRecommendationSection } from './components/HomeRecommendationSection'
import { ProfileSettingsPanel } from './components/ProfileSettingsPanel'
import { TryOnBuilderCard } from './components/TryOnBuilderCard'
import { TryOnResultsSection } from './components/TryOnResultsSection'
import { WardrobeDetailCard } from './components/WardrobeDetailCard'
import { WardrobeEditorPanel } from './components/WardrobeEditorPanel'
import { WardrobeFilterPanel } from './components/WardrobeFilterPanel'
import {
  createWardrobeItem,
  deleteFavoriteLook,
  deleteWardrobeItem,
  analyzeGarmentImage,
  fetchBootstrap,
  saveAvatarProfile,
  fetchSession,
  fetchWeather,
  generateLookTryOnPreview,
  generateOutfitPreview,
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
  uploadAndAnalyzeGarmentsBatch,
  uploadWardrobeImage,
  verifyLoginCode,
  type BootstrapResponse,
} from './api'
import {
  buildDecisionPulseCopy,
  buildEmptyReplacementCopy,
  buildFeedbackCopy,
  buildPrimaryDecisionCopy,
  pickToneVariant,
} from './copy'
import {
  categoryLabels,
  colorLabels,
  fixedCityList,
  fixedCityWeatherOptions,
  homeSceneTabs,
  sceneLabels,
  seasonLabels,
  styleLabels,
  tabLabels,
  thicknessLabels,
} from './app-constants'
import { initialAvatarProfile, initialPreferences, initialWardrobe } from './data'
import { type RecommendationTweak, generateRecommendations, replaceLookItems } from './engine'
import {
  type ImagePreset,
  type AddIntakeMode,
  buildForecastTip,
  buildForecastWeather,
  buildHomeSummaryHighlight,
  buildLocalHistoryEntry,
  buildSavedSectionDescription,
  type ForecastDay,
  forecastDayLabels,
  formatSavedDate,
  getLookItemMap,
  getWeatherLabel,
  inferVisualMeta,
  intakeModeMeta,
  type SavedSection,
  type SavedStyleFilter,
  suggestColorGroupFromRgb,
  toSortableTime,
  type TryOnSelectionSlot,
  type TryOnSelectionState,
  type WardrobeFiltersState,
  type WardrobeQuickFilter,
  wardrobeQuickFilterLabels,
  type WardrobeSort,
} from './app-utils'
import type {
  AvatarProfile,
  ClothingCategory,
  ColorGroup,
  FitType,
  GarmentLength,
  RecommendationLook,
  ReplaceCategory,
  SavedLook,
  Scene,
  SeasonFit,
  Silhouette,
  StyleTag,
  SleeveLength,
  TabId,
  Thickness,
  TryOnSession,
  UserPreferences,
  UserSession,
  WardrobeItem,
  WeatherProfile,
} from './types'

const sessionStorageKey = 'smart-closet-session-token'
const initialSessionToken =
  typeof window !== 'undefined' ? window.localStorage.getItem(sessionStorageKey) ?? '' : ''

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
  sourceImageUrl: string
  draft: SmartDraft | null
  visionDraft: VisionDraftPayload | null
  extracted: boolean
  componentCount: number
  method?: 'cloud_cutout' | 'ai_cutout' | 'local_cutout' | 'ai_studio_fallback' | 'fallback_original'
  needsConfirmation: boolean
  hint: string
  formValues: AddFormState
  status: 'done' | 'error'
  errorMessage?: string
}

type TryOnCapabilities = BootstrapResponse['tryOnCapabilities']

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

const addFormDefaults: AddFormState = {
  name: '',
  category: 'top',
  colorGroup: 'black_white_gray',
  thickness: 'regular',
  style: 'commute',
  imageUrl: '',
  sourceImageUrl: '',
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

const emptyTryOnSelection: TryOnSelectionState = {
  top: '',
  bottom: '',
  dress: '',
  outerwear: '',
  shoes: '',
}

const defaultTryOnCapabilities: TryOnCapabilities = {
  provider: 'mock',
  supportsSingleGarment: true,
  supportsTopBottomOutfit: true,
  supportsOuterwearLayering: false,
  supportsShoesTryOn: false,
  supportsOutfitGeneration: false,
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

function buildAddFormFromUpload(
  imageUrl: string,
  sourceImageUrl: string,
  smartDraft: SmartDraft | null,
  visionDraft: VisionDraftPayload | null,
): AddFormState {
  const applyDraft = Boolean(smartDraft && visionDraft && visionDraft.confidence >= 0.8)

  return {
    ...addFormDefaults,
    imageUrl,
    sourceImageUrl,
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
  if (uploaded.processingMode === 'standard') {
    return uploaded.needsConfirmation
      ? '原图已经先保存好了，AI 也给了初步建议。现在可以直接继续录入；如果想做更干净的展示图，再打开主体提取重传即可。'
      : '原图已经先保存好了，AI 也顺手预填了主要标签。赶时间时现在就能直接加入衣橱。'
  }

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

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [scene, setScene] = useState<Scene>(initialPreferences.defaultScene)
  const [selectedCity, setSelectedCity] = useState('嘉兴')
  const [cityList, setCityList] = useState<Array<{ city: string }>>(fixedCityList.map((city) => ({ city })))
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(initialWardrobe)
  const [preferences, setPreferences] = useState<UserPreferences>(initialPreferences)
  const [avatarProfile, setAvatarProfile] = useState<AvatarProfile>(initialAvatarProfile)
  const [weather, setWeather] = useState<WeatherProfile>(fixedCityWeatherOptions.嘉兴)
  const [forecastDay, setForecastDay] = useState<ForecastDay>('today')
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
  const [previewingTryOnSession, setPreviewingTryOnSession] = useState<TryOnSession | null>(null)
  const [itemSaving, setItemSaving] = useState(false)
  const [imagePreparing, setImagePreparing] = useState(false)
  const [recommendationIndex, setRecommendationIndex] = useState(0)
  const [customLook, setCustomLook] = useState<RecommendationLook | null>(null)
  const [recommendationTweak, setRecommendationTweak] = useState<RecommendationTweak>('balanced')
  const [replaceCategory, setReplaceCategory] = useState<ReplaceCategory | null>(null)
  const [tryOnSelection, setTryOnSelection] = useState<TryOnSelectionState>(emptyTryOnSelection)
  const [openTryOnSlot, setOpenTryOnSlot] = useState<TryOnSelectionSlot | null>(null)
  const [tryOnSelectionTouched, setTryOnSelectionTouched] = useState(false)
  const [tryOnCapabilities, setTryOnCapabilities] = useState<TryOnCapabilities>(defaultTryOnCapabilities)
  const [addForm, setAddForm] = useState<AddFormState>(addFormDefaults)
  const [rawImageUrl, setRawImageUrl] = useState('')
  const [imagePreset, setImagePreset] = useState<ImagePreset>('studio')
  const [editRawImageUrl, setEditRawImageUrl] = useState('')
  const [editImagePreparing, setEditImagePreparing] = useState(false)
  const [editImagePreset, setEditImagePreset] = useState<ImagePreset>('studio')
  const [subjectCutEnabled, setSubjectCutEnabled] = useState(false)
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
  const [imageHint, setImageHint] = useState('拍一张正面照就够，系统会先帮你压缩并直接显示原图，标签识别会一起补上。')
  const [, setFeedback] = useState('先看看今天主推这套，不喜欢的话再往下换。')
  const [editImageHint, setEditImageHint] = useState('换图后会先直接显示原图，再继续补标签识别；需要更干净的展示图时再开主体提取。')
  const [savedSection, setSavedSection] = useState<SavedSection>('history')
  const [savedStyleFilter, setSavedStyleFilter] = useState<SavedStyleFilter>('all')
  const [wardrobeFocusId, setWardrobeFocusId] = useState<string | null>(null)
  const [wardrobeEdit, setWardrobeEdit] = useState<WardrobeEditState | null>(null)
  const [wardrobeSaving, setWardrobeSaving] = useState(false)
  const [wardrobeQuickFilter, setWardrobeQuickFilter] = useState<WardrobeQuickFilter>('all')
  const [filters, setFilters] = useState<WardrobeFiltersState>({
    category: 'all',
    colorGroup: 'all',
    style: 'all',
    status: 'all',
    sort: 'smart' as WardrobeSort,
  })

  const forecastWeather = useMemo(() => buildForecastWeather(weather, forecastDay), [forecastDay, weather])

  const recommendations = useMemo(
    () => generateRecommendations(wardrobe, preferences, forecastWeather, scene, recommendationTweak),
    [forecastWeather, preferences, recommendationTweak, scene, wardrobe],
  )

  const currentLook = customLook ?? recommendations[recommendationIndex] ?? recommendations[0] ?? null

  const buildTryOnSelectionFromLook = (look: RecommendationLook | null): TryOnSelectionState => {
    if (!look) return emptyTryOnSelection

    return look.items.reduce<TryOnSelectionState>((draft, entry) => {
      if (entry.item.category === 'top') draft.top = entry.item.id
      if (entry.item.category === 'bottom') draft.bottom = entry.item.id
      if (entry.item.category === 'dress') draft.dress = entry.item.id
      if (entry.item.category === 'outerwear') draft.outerwear = entry.item.id
      if (entry.item.category === 'shoes') draft.shoes = entry.item.id
      return draft
    }, { ...emptyTryOnSelection })
  }

  const buildTryOnLookKeyFromItemIds = (itemIds: string[]) => [...new Set(itemIds.filter(Boolean))].sort().join('__')

  const alternativeLooks = recommendations
    .filter((look, index) => (customLook ? look.id !== customLook.id : index !== recommendationIndex))
    .slice(0, 3)

  const replaceableCategories = useMemo(() => {
    if (!currentLook || !replaceCategory) return []

    const categoryOrder: ReplaceCategory[] = ['dress', 'top', 'bottom', 'shoes', 'outerwear', 'accessory']
    return categoryOrder
      .map((category) => ({
        category,
        options: replaceLookItems(currentLook, category, wardrobe, preferences, forecastWeather, scene, 3, recommendationTweak),
      }))
      .filter((entry) => entry.options.length > 0)
  }, [currentLook, forecastWeather, preferences, recommendationTweak, replaceCategory, scene, wardrobe])

  const activeReplaceCategory = useMemo(() => {
    if (!replaceCategory) return null
    if (replaceableCategories.some((entry) => entry.category === replaceCategory)) return replaceCategory
    return replaceableCategories[0]?.category ?? null
  }, [replaceCategory, replaceableCategories])

  const replacementOptions = useMemo(() => {
    if (!currentLook || !activeReplaceCategory) return []
    return replaceableCategories.find((entry) => entry.category === activeReplaceCategory)?.options ?? []
  }, [activeReplaceCategory, currentLook, replaceableCategories])
  const forecastDayLabel = forecastDayLabels[forecastDay]

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
  const recentAddedThreshold = useMemo(() => {
    const rankedTimes = wardrobe
      .map((entry) => toSortableTime(entry.createdAt))
      .filter((time) => time > 0)
      .sort((left, right) => right - left)

    return rankedTimes[Math.min(7, rankedTimes.length - 1)] ?? 0
  }, [wardrobe])

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
            const createdAt = toSortableTime(item.createdAt)
            if (createdAt > 0) {
              return createdAt >= recentAddedThreshold
            }
            const originalIndex = wardrobe.findIndex((entry) => entry.id === item.id)
            return originalIndex >= 0 && originalIndex < Math.min(8, wardrobe.length || 8)
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
    [filters, recentAddedThreshold, wardrobe, wardrobeQuickFilter],
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

  const tryOnSelectableItems = useMemo(
    () => wardrobe.filter((item) => Boolean(item.imageUrl) && item.category !== 'accessory'),
    [wardrobe],
  )
  const wardrobeItemMap = useMemo(() => new Map(wardrobe.map((item) => [item.id, item])), [wardrobe])
  const tryOnSelectableItemMap = useMemo(
    () => new Map(tryOnSelectableItems.map((item) => [item.id, item])),
    [tryOnSelectableItems],
  )

  const tryOnSlotOptions = useMemo(
    () => ({
      top: tryOnSelectableItems.filter((item) => item.category === 'top'),
      bottom: tryOnSelectableItems.filter((item) => item.category === 'bottom'),
      dress: tryOnSelectableItems.filter((item) => item.category === 'dress'),
      outerwear: tryOnSelectableItems.filter((item) => item.category === 'outerwear'),
      shoes: tryOnSelectableItems.filter((item) => item.category === 'shoes'),
    }),
    [tryOnSelectableItems],
  )

  const buildTryOnOptionLabel = (item: WardrobeItem) =>
    `${item.name} · ${colorLabels[item.colorGroup]} / ${styleLabels[item.style]} / ${thicknessLabels[item.thickness]}`

  const filteredSavedLooks = useMemo(() => {
    const entries = savedSection === 'history' ? historyLooks : favoriteLooks
    if (savedStyleFilter === 'all') return entries
    return entries.filter((entry) => entry.look.style === savedStyleFilter)
  }, [favoriteLooks, historyLooks, savedSection, savedStyleFilter])

  const editingWardrobeItem = useMemo(
    () => (wardrobeEdit?.id ? wardrobeItemMap.get(wardrobeEdit.id) ?? null : null),
    [wardrobeEdit?.id, wardrobeItemMap],
  )

  const focusedWardrobeItem = useMemo(
    () => (wardrobeFocusId ? wardrobeItemMap.get(wardrobeFocusId) ?? null : null),
    [wardrobeFocusId, wardrobeItemMap],
  )
  const completedRealTryOnSessions = useMemo(
    () =>
      [...tryOnSessions]
        .filter((entry) => entry.status === 'completed' && entry.resultImageUrl && entry.provider !== 'mock')
        .sort((left, right) => toSortableTime(right.updatedAt) - toSortableTime(left.updatedAt)),
    [tryOnSessions],
  )

  const getTryOnDisplayImageUrl = (entry: TryOnSession) => entry.baseResultImageUrl || entry.resultImageUrl || ''
  const lookNeedsOutfitPreview = (look: RecommendationLook) =>
    look.items.some((entry) => entry.item.category === 'outerwear' || entry.item.category === 'shoes')

  const getLookPrimaryItem = (look: RecommendationLook) =>
    (() => {
      const lookItemMap = getLookItemMap(look)
      return lookItemMap.dress ?? lookItemMap.top ?? null
    })()

  const buildLookTryOnKey = (look: RecommendationLook) =>
    buildTryOnLookKeyFromItemIds(
      look.items
        .filter((entry) => entry.item.category !== 'shoes' && entry.item.category !== 'accessory')
        .map((entry) => entry.item.id),
    )

  const buildOutfitGenerationKey = (look: RecommendationLook) =>
    `outfit:${buildTryOnLookKeyFromItemIds(
      look.items.filter((entry) => entry.item.category !== 'accessory').map((entry) => entry.item.id),
    )}`

  const getLookTryOnSession = (look: RecommendationLook) => {
    const lookKey = buildLookTryOnKey(look)
    const outfitKey = buildOutfitGenerationKey(look)
    if (!lookKey && !outfitKey) return null

    const needsOutfitPreview = lookNeedsOutfitPreview(look)

    const outfitMatch = completedRealTryOnSessions.find((entry) => entry.lookKey === outfitKey)
    const exactLookMatch = completedRealTryOnSessions.find((entry) => entry.lookKey === lookKey)

    if (needsOutfitPreview) {
      if (outfitMatch) return outfitMatch
      if (exactLookMatch) return exactLookMatch
    }

    if (exactLookMatch) return exactLookMatch

    if (outfitMatch) return outfitMatch

    const primaryItem = getLookPrimaryItem(look)
    if (primaryItem) {
      const primaryMatch = completedRealTryOnSessions.find((entry) => entry.garmentItemId === primaryItem.id)
      if (look.items.some((entry) => entry.item.category === 'dress') && primaryMatch) return primaryMatch
    }

    return null
  }

  const upsertTryOnSession = (session: TryOnSession) => {
    setTryOnSessions((current) => {
      const existingIndex = current.findIndex((entry) => entry.id === session.id)
      if (existingIndex >= 0) {
        return current.map((entry) => (entry.id === session.id ? session : entry))
      }
      return [session, ...current]
    })
  }

  const handleTryOnSelectionChange = (slot: TryOnSelectionSlot, itemId: string) => {
    setTryOnSelectionTouched(true)
    setTryOnSelection((current) => {
      const next = { ...current, [slot]: itemId }
      if (slot === 'dress' && itemId) {
        next.top = ''
        next.bottom = ''
      }
      if ((slot === 'top' || slot === 'bottom') && itemId) {
        next.dress = ''
      }
      return next
    })
    setOpenTryOnSlot(null)
  }

  const renderTryOnSlotField = (
    slot: TryOnSelectionSlot,
    title: string,
    placeholder: string,
    options: WardrobeItem[],
    selectedId: string,
    disabled = false,
  ) => {
    const selectedItem =
      options.find((item) => item.id === selectedId) ?? (selectedId ? tryOnSelectableItemMap.get(selectedId) ?? null : null)
    const isOpen = openTryOnSlot === slot
    const previewItems = options.slice(0, 10)

    return (
      <label className={`try-on-slot-field${disabled ? ' disabled' : ''}`}>
        <span>{title}</span>
        <button
          type="button"
          className={`try-on-slot-trigger${isOpen ? ' active' : ''}`}
          onClick={() => setOpenTryOnSlot((current) => (current === slot ? null : slot))}
          disabled={disabled}
        >
          <div className="try-on-slot-trigger-copy">
            <strong>{selectedItem ? selectedItem.name : placeholder}</strong>
            <span>
              {selectedItem
                ? `${colorLabels[selectedItem.colorGroup]} / ${styleLabels[selectedItem.style]} / ${thicknessLabels[selectedItem.thickness]}`
                : `${tryOnSlotOptions[slot].length} 件可选`}
            </span>
          </div>
          <em>{isOpen ? '收起' : '展开'}</em>
        </button>
        {isOpen ? (
          <div className="try-on-slot-panel">
            <button type="button" className={`try-on-slot-option clear${!selectedId ? ' active' : ''}`} onClick={() => handleTryOnSelectionChange(slot, '')}>
              <div className="try-on-slot-option-copy">
                <strong>{placeholder}</strong>
                <span>先把这个位置空出来</span>
              </div>
            </button>
            {options.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`try-on-slot-option${selectedId === item.id ? ' active' : ''}`}
                onClick={() => handleTryOnSelectionChange(slot, item.id)}
              >
                <div className="try-on-slot-option-thumb">{renderItemVisual(item)}</div>
                <div className="try-on-slot-option-copy">
                  <strong>{item.name}</strong>
                  <span>{buildTryOnOptionLabel(item)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : null}
        {selectedItem ? (
          <button type="button" className="try-on-selected-inline" onClick={() => handleTryOnSelectionChange(slot, '')} disabled={disabled}>
            <div className="try-on-selected-inline-thumb">{renderItemVisual(selectedItem)}</div>
            <div className="try-on-selected-inline-copy">
              <strong>{selectedItem.name}</strong>
              <span>
                {colorLabels[selectedItem.colorGroup]} / {styleLabels[selectedItem.style]} / {thicknessLabels[selectedItem.thickness]}
              </span>
            </div>
            <em>点一下清空</em>
          </button>
        ) : isOpen && previewItems.length > 0 ? (
          <div className="try-on-quick-picks">
            {previewItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`try-on-quick-pick${selectedId === item.id ? ' active' : ''}`}
                onClick={() => handleTryOnSelectionChange(slot, item.id)}
                disabled={disabled}
              >
                <div className="try-on-quick-pick-thumb">{renderItemVisual(item)}</div>
                <strong>{item.name}</strong>
                <span>
                  {colorLabels[item.colorGroup]} / {styleLabels[item.style]}
                </span>
              </button>
            ))}
          </div>
        ) : isOpen ? (
          <div className="empty-inline">这个位置暂时还没有可选的{title}。</div>
        ) : null}
      </label>
    )
  }

  const handleFillTryOnFromCurrentLook = () => {
    setTryOnSelectionTouched(true)
    setTryOnSelection(buildTryOnSelectionFromLook(currentLook))
    setFeedback(buildFeedbackCopy('fill_current_look', `fill-${currentLook?.id ?? 'none'}`))
  }

  const handleClearTryOnSelection = () => {
    setTryOnSelectionTouched(true)
    setTryOnSelection(emptyTryOnSelection)
    setFeedback(buildFeedbackCopy('clear_tryon', `clear-${Date.now()}`))
  }

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
        const nextCity: (typeof fixedCityList)[number] = fixedCityList.includes(data.selectedCity as (typeof fixedCityList)[number])
          ? (data.selectedCity as (typeof fixedCityList)[number])
          : '嘉兴'
        const bootstrapWeather = fixedCityWeatherOptions[nextCity]
        setWardrobe(data.wardrobe)
        setPreferences(data.preferences)
        setAvatarProfile(data.avatarProfile)
        setWeather(bootstrapWeather)
        setWeatherError('')
        setWeatherLoading(true)
        setSelectedCity(nextCity)
        setScene(data.preferences.defaultScene)
        const availableCities = data.cities.filter((item) =>
          fixedCityList.includes(item.city as (typeof fixedCityList)[number]),
        )
        setCityList(availableCities.length > 0 ? availableCities : fixedCityList.map((city) => ({ city })))
        setHistoryLooks(data.history)
        setFavoriteLooks(data.favorites)
        setTryOnSessions(data.tryOnSessions)
        setTryOnCapabilities(data.tryOnCapabilities ?? defaultTryOnCapabilities)
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
    const city = fixedCityWeatherOptions[selectedCity as (typeof fixedCityList)[number]] ?? fixedCityWeatherOptions.嘉兴

    fetchWeather(city.city)
      .then((nextWeather) => {
        if (!ignore) setWeather(nextWeather)
      })
      .catch(() => {
        if (!ignore) {
          setWeather(city)
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
    const resetTimer = window.setTimeout(() => {
      setRecommendationIndex(0)
      setCustomLook(null)
      setReplaceCategory(null)
    }, 0)

    return () => {
      window.clearTimeout(resetTimer)
    }
  }, [wardrobe, preferences, scene, selectedCity, forecastDay, forecastWeather.feelsLike, forecastWeather.tempGap, forecastWeather.rainProbability])

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
    const safeCity: (typeof fixedCityList)[number] = fixedCityList.includes(nextCity as (typeof fixedCityList)[number])
      ? (nextCity as (typeof fixedCityList)[number])
      : '嘉兴'
    const city = fixedCityWeatherOptions[safeCity]
    setWeather(city)
    setWeatherLoading(true)
    setWeatherError('')
    setSelectedCity(safeCity)
    saveSelectedCity(safeCity).catch(() => {
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
      setFeedback(buildFeedbackCopy('avatar_saved', `avatar-${saved.heightCm}-${saved.weightKg}`))
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
      setFeedback(buildFeedbackCopy('tryon_photo_saved', `tryon-photo-${saved.tryOnPhotoUrl ?? 'none'}`))
      setApiMessage('')
    } catch {
      setApiMessage('图片上传慢了一点，请再试一次。')
    } finally {
      setAvatarPhotoUploading(false)
      event.target.value = ''
    }
  }

  const handleCreateMockPreview = async (sessionId: string) => {
    setTryOnPreviewingId(sessionId)
    try {
      const updated = await generateTryOnPreview(sessionId)
      upsertTryOnSession(updated)
      setFeedback(buildFeedbackCopy('mock_ready', `mock-${sessionId}`))
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

  const handleGenerateCurrentLookTryOn = async (look: RecommendationLook) => {
    const garmentItemIds = look.items
      .filter((entry) => entry.item.category !== 'shoes' && entry.item.category !== 'accessory')
      .map((entry) => entry.item.id)

    if (garmentItemIds.length === 0) {
      setFeedback('这套当前没有可生成上身效果的衣物。')
      return
    }

    if (!avatarProfile.tryOnPhotoUrl) {
      setApiMessage('请先去“我的”里上传参考照，再生成这套上身效果。')
      return
    }

    const missingReadyItem = garmentItemIds.find((itemId) => !tryOnReadyItems.some((item) => item.id === itemId))
    if (missingReadyItem) {
      setApiMessage('这套里有单品还没准备好试穿信息，请先到衣橱确认单品资料。')
      return
    }

    setTryOnCreating(true)
    setTryOnPreviewingId(buildLookTryOnKey(look))
    try {
      const updated = await generateLookTryOnPreview(garmentItemIds, true)
      upsertTryOnSession(updated)
      setFeedback(buildFeedbackCopy('look_tryon_ready', `look-tryon-${garmentItemIds.join('-')}`))
      setApiMessage('')
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : '这套上身效果生成失败了，请稍后再试。')
    } finally {
      setTryOnCreating(false)
      setTryOnPreviewingId('')
    }
  }

  const handleGenerateCurrentOutfitPreview = async (look: RecommendationLook) => {
    const garmentItemIds = look.items.filter((entry) => entry.item.category !== 'accessory').map((entry) => entry.item.id)

    if (garmentItemIds.length === 0) {
      setFeedback('这套当前没有可生成整套效果图的衣物。')
      return
    }

    if (!avatarProfile.tryOnPhotoUrl) {
      setApiMessage('请先去“我的”里上传参考照，再生成整套效果图。')
      return
    }

    const missingReadyItem = garmentItemIds.find((itemId) => !tryOnSelectableItems.some((item) => item.id === itemId))
    if (missingReadyItem) {
      setApiMessage('这套里有单品还没准备好，请先到衣橱确认图片。')
      return
    }

    setTryOnCreating(true)
    setTryOnPreviewingId(`outfit-${buildOutfitGenerationKey(look)}`)
    try {
      const updated = await generateOutfitPreview(garmentItemIds, true, `${sceneLabels[scene]} / ${styleLabels[look.style]}风`)
      upsertTryOnSession(updated)
      setFeedback(buildFeedbackCopy('outfit_ready', `outfit-${garmentItemIds.join('-')}-${scene}`))
      setApiMessage('')
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : '整套效果图生成失败了，请稍后再试。')
    } finally {
      setTryOnCreating(false)
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
    setEditImageHint('换图会先直接显示原图，后面再继续补标签；想要更干净的展示图时再开主体提取。')
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
      sourceImageUrl: item.sourceImageUrl ?? item.imageUrl ?? '',
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
    let storedSourceImageUrl: string
    if (wardrobeEdit.imageUrl.startsWith('data:image/')) {
      const uploaded = await uploadWardrobeImage(wardrobeEdit.imageUrl, subjectCutEnabled ? 'subject' : 'standard')
      storedImageUrl = uploaded.imageUrl
      storedSourceImageUrl = uploaded.sourceImageUrl
    } else if (wardrobeEdit.imageUrl) {
      storedImageUrl = wardrobeEdit.imageUrl
      storedSourceImageUrl = wardrobeEdit.sourceImageUrl || editingWardrobeItem?.sourceImageUrl || wardrobeEdit.imageUrl
    } else {
      storedImageUrl = ''
      storedSourceImageUrl = ''
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
      displayImageUrl: storedImageUrl || null,
      sourceImageUrl: storedSourceImageUrl || null,
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
        sourceImageUrl: updated.sourceImageUrl ?? updated.imageUrl ?? '',
      })
      setEditRawImageUrl('')
      setEditImagePreset('studio')
      setEditImageHint('换图会先直接显示原图，后面再继续补标签；想要更干净的展示图时再开主体提取。')
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
    setFeedback(buildFeedbackCopy('refresh_look', `refresh-${recommendationIndex}-${scene}-${forecastDay}`))
  }

  const handleSelectRecommendationTweak = (tweak: RecommendationTweak) => {
    setRecommendationTweak(tweak)
    setCustomLook(null)
    setRecommendationIndex(0)
    setReplaceCategory(null)
  }

  const handleToggleReplacePanel = () => {
    if (replaceCategory) {
      setReplaceCategory(null)
      return
    }

    const nextCategory = replaceableCategories[0]?.category ?? null
    if (!nextCategory) {
      setFeedback('这一套暂时没有更合适的替换项了。')
      return
    }

    setReplaceCategory(nextCategory)
    window.requestAnimationFrame(() => {
      document.getElementById('replace-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const applyReplacement = (look: RecommendationLook) => {
    setCustomLook(look)
    setReplaceCategory(null)
    setFeedback(buildFeedbackCopy('replace_look', `replace-${look.id}`))
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    setImagePreparing(true)
    setImageHint(
      files.length > 1
        ? `正在批量处理 ${files.length} 张图片…`
        : subjectCutEnabled
          ? '正在上传图片，系统会继续做主体提取和品类识别，这一档会慢一些。'
          : '正在上传图片，先把原图显示出来，再继续补标签识别。',
    )
    clearBatchExtraction()
    setBatchExtractionTotal(files.length)

    try {
      const nextItems: BatchExtractionItem[] = []

      if (files.length > 1 && !subjectCutEnabled) {
        try {
          const batchChunkSize = 3
          const optimizedItems = await Promise.all(
            files.map(async (file) => ({
              fileName: file.name,
              optimized: await optimizeImageForMobile(file),
            })),
          )

          for (let startIndex = 0; startIndex < optimizedItems.length; startIndex += batchChunkSize) {
            const chunk = optimizedItems.slice(startIndex, startIndex + batchChunkSize)
            setBatchExtractionCurrentName(
              `正在识别第 ${startIndex + 1} 到 ${Math.min(startIndex + chunk.length, optimizedItems.length)} 张`,
            )

            const uploadedBatch = await uploadAndAnalyzeGarmentsBatch(
              chunk.map((item) => ({
                fileName: item.fileName,
                dataUrl: item.optimized.dataUrl,
              })),
              'standard',
            )

            uploadedBatch.results
              .sort((a, b) => a.index - b.index)
              .forEach((uploadedResult, chunkIndex) => {
                const optimized = chunk[chunkIndex]?.optimized
                if (!optimized) return

                const normalizedVisionDraft = normalizeVisionDraftPayload(uploadedResult.draft)
                const nextDraft = normalizedVisionDraft ? mapVisionDraftToSmartDraft(normalizedVisionDraft) : null
                nextItems.push({
                  id: `batch-${crypto.randomUUID()}`,
                  fileName: uploadedResult.fileName,
                  rawImageUrl: optimized.dataUrl,
                  imageUrl: uploadedResult.imageUrl,
                  sourceImageUrl: uploadedResult.sourceImageUrl,
                  draft: nextDraft,
                  visionDraft: normalizedVisionDraft,
                  extracted: uploadedResult.subjectStats.extracted,
                  componentCount: uploadedResult.subjectStats.componentCount,
                  method: uploadedResult.subjectStats.method,
                  needsConfirmation: uploadedResult.needsConfirmation,
                  hint: buildUploadHint(uploadedResult),
                  formValues: buildAddFormFromUpload(
                    uploadedResult.imageUrl,
                    uploadedResult.sourceImageUrl,
                    nextDraft,
                    normalizedVisionDraft,
                  ),
                  status: 'done',
                })
              })

            setBatchExtractionItems([...nextItems])
            setBatchExtractionCompleted(nextItems.length)

            if (!batchExtractionSelectedId && nextItems.length === chunk.length) {
              applyBatchExtractionItem(nextItems[0])
            }
          }

          const firstSuccess = nextItems[0] ?? null
          if (firstSuccess) {
            applyBatchExtractionItem(firstSuccess)
            setImageHint('这批图片已经批量识别完成，结果保留在下面；点任意一张即可切回继续录入。')
          } else {
            setImageHint('这批图片都没处理成功，可以换一批再试。')
          }

          return
        } catch (error) {
          setApiMessage(error instanceof Error ? error.message : '批量识别这次没有成功，已自动切回逐张处理。')
          setImageHint('批量识别这次没有成功，正在自动切回逐张处理。')
          setBatchExtractionItems([])
          setBatchExtractionCompleted(0)
          setBatchExtractionCurrentName('')
        }
      }

      for (const [index, file] of files.entries()) {
        setBatchExtractionCurrentName(file.name)

        try {
          const optimized = await optimizeImageForMobile(file)
          if (files.length === 1) {
            setRawImageUrl(optimized.dataUrl)
            setImagePreset('studio')
            setSmartDraftState(null)
            setSmartDraftImageUrl(optimized.dataUrl)
            setAddForm((current) => ({
              ...current,
              imageUrl: optimized.dataUrl,
              sourceImageUrl: optimized.dataUrl,
            }))
          }
          const uploaded = await uploadAndAnalyzeGarment(optimized.dataUrl, subjectCutEnabled ? 'subject' : 'standard')
          const normalizedVisionDraft = normalizeVisionDraftPayload(uploaded.draft)
          const nextDraft = normalizedVisionDraft ? mapVisionDraftToSmartDraft(normalizedVisionDraft) : null
          const nextItem: BatchExtractionItem = {
            id: `batch-${crypto.randomUUID()}`,
            fileName: file.name,
            rawImageUrl: optimized.dataUrl,
            imageUrl: uploaded.imageUrl,
            sourceImageUrl: uploaded.sourceImageUrl,
            draft: nextDraft,
            visionDraft: normalizedVisionDraft,
            extracted: uploaded.subjectStats.extracted,
            componentCount: uploaded.subjectStats.componentCount,
            method: uploaded.subjectStats.method,
            needsConfirmation: uploaded.needsConfirmation,
            hint: buildUploadHint(uploaded),
            formValues: buildAddFormFromUpload(
              uploaded.imageUrl,
              uploaded.sourceImageUrl,
              nextDraft,
              normalizedVisionDraft,
            ),
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
            sourceImageUrl: '',
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
        if (files.length > 1) {
          setImageHint('这批图片已经处理完成，结果保留在下面；点任意一张即可切回继续录入。')
        }
      } else {
        setImageHint('这批图片都没处理成功，可以换一批再试。')
      }
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : '图片处理失败了，请稍后再试。')
      setImageHint('这批图片处理失败了，可以换一批再试。')
      setBatchExtractionCurrentName('')
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
    setEditImageHint(
      subjectCutEnabled
        ? '正在上传新图片，系统会继续做主体提取和品类识别，这一档会慢一些。'
        : '正在上传新图片，先显示原图，再继续补标签识别。',
    )

    try {
      const optimized = await optimizeImageForMobile(file)
      setEditRawImageUrl(optimized.dataUrl)
      setEditImagePreset('studio')
      setWardrobeEdit((current) =>
        current
          ? {
              ...current,
              imageUrl: optimized.dataUrl,
              sourceImageUrl: optimized.dataUrl,
            }
          : current,
      )
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
              sourceImageUrl: uploaded.sourceImageUrl,
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
    setAddForm((current) => ({ ...current, imageUrl: '', sourceImageUrl: '' }))
    setRawImageUrl('')
    setImagePreset('studio')
    setSmartDraftState(null)
    setSmartDraftImageUrl('')
    setBatchExtractionSelectedId(null)
    setImageHint('图片已移除，现在会恢复为纯色卡片占位。')
  }

  const handleRemoveWardrobeEditImage = () => {
    setWardrobeEdit((current) => (current ? { ...current, imageUrl: '', sourceImageUrl: '' } : current))
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
      setFeedback(buildFeedbackCopy('edit_draft_applied', `edit-draft-${wardrobeEdit?.id ?? 'none'}`))
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
      let storedSourceImageUrl = ''
      if (addForm.imageUrl.startsWith('data:image/')) {
        const uploaded = await uploadWardrobeImage(addForm.imageUrl, subjectCutEnabled ? 'subject' : 'standard')
        storedImageUrl = uploaded.imageUrl
        storedSourceImageUrl = uploaded.sourceImageUrl
      } else if (addForm.imageUrl) {
        storedImageUrl = addForm.imageUrl
        storedSourceImageUrl = addForm.sourceImageUrl || addForm.imageUrl
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
        displayImageUrl: storedImageUrl || undefined,
        sourceImageUrl: storedSourceImageUrl || storedImageUrl || undefined,
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
        setFeedback(buildFeedbackCopy('batch_next_saved', `batch-next-${nextBatchItem.id}`))
      } else {
        setAddForm(addFormDefaults)
        setRawImageUrl('')
        setImagePreset('studio')
        setSubjectCutEnabled(false)
        setSmartDraftState(null)
        setSmartDraftImageUrl('')
        setBatchExtractionSelectedId(null)
        clearBatchExtraction()
        setImageHint('拍一张正面照就够，系统会先帮你压缩并直接显示原图，标签识别会一起补上。')
        setActiveTab('home')
        setFeedback(buildFeedbackCopy('wardrobe_saved', `saved-${newItem.id}`))
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

  const renderLookStage = (look: RecommendationLook, compact = false, tryOnImageUrl = '') => {
    const lookItemMap = getLookItemMap(look)
    const dress = lookItemMap.dress
    const top = lookItemMap.top
    const bottom = lookItemMap.bottom
    const outerwear = lookItemMap.outerwear
    const shoes = lookItemMap.shoes
    const accessory = lookItemMap.accessory

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

    if (tryOnImageUrl) {
      return (
        <div className={`look-stage-result${compact ? ' compact' : ''}`}>
          <img src={tryOnImageUrl} alt={`${styleLabels[look.style]}风试穿结果`} />
        </div>
      )
    }

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
    const practicalItems = look.items.filter((entry) => entry.item.category !== 'accessory')
    const backupOuterwear = look.backupOuterwear ?? null
    const visualSession = getLookTryOnSession(look)
    const tryOnImageUrl = visualSession ? getTryOnDisplayImageUrl(visualSession) : ''
    const needsOutfitPreview = lookNeedsOutfitPreview(look)
    const lookTryOnKey = buildLookTryOnKey(look)
    const lookOutfitKey = buildOutfitGenerationKey(look)
    const canGenerateTryOn = Boolean(
      interactive &&
        lookTryOnKey &&
        avatarProfile.tryOnPhotoUrl &&
        !needsOutfitPreview &&
        look.items
          .filter((entry) => entry.item.category !== 'shoes' && entry.item.category !== 'accessory')
          .every((entry) => tryOnReadyItems.some((item) => item.id === entry.item.id)),
    )
    const canGenerateLookOutfit = Boolean(
      interactive &&
        lookOutfitKey &&
        tryOnCapabilities.supportsOutfitGeneration &&
        avatarProfile.tryOnPhotoUrl &&
        practicalItems.every((entry) => tryOnSelectableItems.some((item) => item.id === entry.item.id)),
    )
    const isGeneratingCurrentLook = Boolean(lookTryOnKey && tryOnCreating && tryOnPreviewingId === lookTryOnKey)
    const isGeneratingCurrentOutfit = Boolean(lookOutfitKey && tryOnCreating && tryOnPreviewingId === `outfit-${lookOutfitKey}`)
    const currentGenerationMessage =
      isGeneratingCurrentOutfit || isGeneratingCurrentLook ? '正在生成效果图，通常需要几秒到 20 秒。' : ''
    const copySeed = `${look.id}-${forecastWeather.feelsLike}-${scene}-${backupOuterwear ? backupOuterwear.id : 'none'}`
    const recommendationPulse = buildDecisionPulseCopy(look.scores.total, copySeed)
    const primaryDecision = buildPrimaryDecisionCopy(look.scores.total, `${copySeed}-decision`)
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
          <div className={`look-stage-wrap${tryOnImageUrl ? ' has-real-result' : ''}`}>
            {renderLookStage(look, compact, tryOnImageUrl)}
              <div className="look-stage-note">
                <div className="look-stage-note-top">
                  <span className="chip">{sceneLabels[scene]}</span>
                  <span className="chip">体感 {forecastWeather.feelsLike}°C</span>
                  <span className="chip">
                    {tryOnImageUrl ? '效果图' : recommendationPulse}
                  </span>
                </div>
              </div>
          </div>
          <div className="look-brief">
            {interactive ? (
              <div className="decision-bar">
                <div className="decision-bar-copy">
                  <strong>{primaryDecision}</strong>
                  <span>{replaceCategory ? '现在是在微调模式，点一次“微调单件”就能收起来。' : '先看整套感觉，不满意再改单件会更快。'}</span>
                </div>
                <div className="decision-bar-actions">
                  <button className="primary" onClick={handleWearLook}>
                    穿这套
                  </button>
                  <button className="secondary" onClick={handleRefreshLook}>
                    再看一套
                  </button>
                  <button className={`ghost${replaceCategory ? ' active-soft' : ''}`} onClick={handleToggleReplacePanel}>
                    微调单件
                  </button>
                </div>
              </div>
            ) : null}

            <div className="look-brief-copy">
              {interactive ? (
                <div className="look-tryon-cta">
                  <span>
                    {canGenerateLookOutfit || canGenerateTryOn
                      ? tryOnImageUrl
                        ? '这套已经有结果了，不满意的话可以直接重新生成。'
                        : '这套已经可以直接生成效果图了。'
                      : '这套暂时还不能直接生成效果图。'}
                  </span>
                  {needsOutfitPreview ? (
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => handleGenerateCurrentOutfitPreview(look)}
                      disabled={!canGenerateLookOutfit || isGeneratingCurrentOutfit}
                    >
                      {isGeneratingCurrentOutfit ? '生成中…' : tryOnImageUrl ? '重新生成效果图' : '生成效果图'}
                    </button>
                  ) : (
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => handleGenerateCurrentLookTryOn(look)}
                      disabled={!canGenerateTryOn || isGeneratingCurrentLook}
                    >
                      {isGeneratingCurrentLook ? '生成中…' : tryOnImageUrl ? '重新生成效果图' : '生成效果图'}
                    </button>
                  )}
                </div>
              ) : null}
              {currentGenerationMessage ? <div className="inline-progress-note">{currentGenerationMessage}</div> : null}
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

            {backupOuterwear ? (
              <div className="backup-outerwear-card">
                <div className="backup-outerwear-copy">
                  <span className="item-badge">备用外套</span>
                  <strong>早晚会凉时带上这件更稳</strong>
                  <p>
                    这件不算主穿搭，主要给你应对温差、风大或突然下雨的时候备用。
                  </p>
                </div>
                <div className="item-card condensed backup-outerwear-item">
                  <div className="item-card-top">
                    {renderItemVisual(backupOuterwear)}
                    <div className="item-copy">
                      <strong>{backupOuterwear.name}</strong>
                      <p>{categoryLabels[backupOuterwear.category]} / {styleLabels[backupOuterwear.style]}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className={`item-grid condensed${compact ? ' compact' : ''}`}>
              {look.items.map(({ item }) => (
                <div className="item-card condensed" key={item.id}>
                <div className="item-card-top">
                  {renderItemVisual(item)}
                  <div className="item-copy">
                    {tryOnImageUrl && item.category === 'shoes' ? <span className="item-badge">推荐鞋</span> : null}
                    <strong>{item.name}</strong>
                    <p>
                      {item.category === 'shoes' && tryOnImageUrl
                        ? '鞋子 / 作为搭配建议'
                        : `${categoryLabels[item.category]} / ${styleLabels[item.style]}`}
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
              </div>
            ) : null}
          </div>
        </div>

      </article>
    )
  }

  const renderReplacePreview = (baseLook: RecommendationLook, nextLook: RecommendationLook, category: ReplaceCategory) => {
    const currentItem = baseLook.items.find((entry) => entry.item.category === category)?.item
    const nextItem = nextLook.items.find((entry) => entry.item.category === category)?.item
    if (!currentItem || !nextItem) return null

    return (
      <div className="replace-preview-card" onClick={() => applyReplacement(nextLook)} role="button" tabIndex={0} onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          applyReplacement(nextLook)
        }
      }}>
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
          <p>{buildSavedSectionDescription(savedSection)}</p>
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
                setFeedback(
                  savedSection === 'history'
                    ? buildFeedbackCopy('saved_restore_history', `saved-restore-${entry.id}`)
                    : buildFeedbackCopy('saved_restore_favorite', `favorite-restore-${entry.id}`),
                )
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
                  setFeedback(buildFeedbackCopy('saved_quick_open', `saved-quick-open-${entry.id}`))
                }}
              >
                再看这套
              </button>
            )}
          </div>
        ))}

        {filteredSavedLooks.length === 0 ? (
          <p>
            {savedSection === 'history'
              ? pickToneVariant(`saved-empty-${savedStyleFilter}`, [
                  '当前筛选下还没有穿搭记录。',
                  '这个筛选下暂时还没有留下来的穿搭结果。',
                  '这里现在还是空的，等你多穿几次后会慢慢丰富起来。',
                ])
              : pickToneVariant(`favorite-empty-${savedStyleFilter}`, [
                  '当前筛选下还没有收藏搭配。',
                  '这个筛选里还没有你专门留下来的搭配。',
                  '这里暂时还空着，遇到真正顺手的搭配再收进来就行。',
                ])}
          </p>
        ) : null}
      </div>
    </article>
  )

  const rawTryOnSelection = tryOnSelectionTouched ? tryOnSelection : buildTryOnSelectionFromLook(currentLook)
  const effectiveTryOnSelection: TryOnSelectionState = {
    ...rawTryOnSelection,
    outerwear:
      tryOnCapabilities.supportsOuterwearLayering || tryOnCapabilities.supportsOutfitGeneration
        ? rawTryOnSelection.outerwear
        : '',
    shoes:
      tryOnCapabilities.supportsShoesTryOn || tryOnCapabilities.supportsOutfitGeneration
        ? rawTryOnSelection.shoes
        : '',
  }
  const selectedTryOnTop = effectiveTryOnSelection.top ? tryOnSelectableItemMap.get(effectiveTryOnSelection.top) ?? null : null
  const selectedTryOnBottom = effectiveTryOnSelection.bottom ? tryOnSelectableItemMap.get(effectiveTryOnSelection.bottom) ?? null : null
  const selectedTryOnDress = effectiveTryOnSelection.dress ? tryOnSelectableItemMap.get(effectiveTryOnSelection.dress) ?? null : null
  const selectedTryOnOuterwear = effectiveTryOnSelection.outerwear ? tryOnSelectableItemMap.get(effectiveTryOnSelection.outerwear) ?? null : null
  const selectedTryOnShoes = effectiveTryOnSelection.shoes ? tryOnSelectableItemMap.get(effectiveTryOnSelection.shoes) ?? null : null
  const hasManualTryOnBase = Boolean(selectedTryOnDress || (selectedTryOnTop && selectedTryOnBottom))
  const tryOnGarmentItems = [
    ...(selectedTryOnDress ? [selectedTryOnDress] : [selectedTryOnTop, selectedTryOnBottom].filter(Boolean)),
    ...(selectedTryOnOuterwear ? [selectedTryOnOuterwear] : []),
  ] as WardrobeItem[]
  const tryOnPreviewItems = [...tryOnGarmentItems, ...(selectedTryOnShoes ? [selectedTryOnShoes] : [])]
  const tryOnOuterwearBlocked = Boolean(selectedTryOnOuterwear) && !tryOnCapabilities.supportsOuterwearLayering
  const tryOnShoesBlocked = Boolean(selectedTryOnShoes) && !tryOnCapabilities.supportsShoesTryOn
  const needsOutfitGeneration = Boolean(selectedTryOnOuterwear || selectedTryOnShoes)
  const tryOnPreviewLook: RecommendationLook | null = hasManualTryOnBase
    ? {
        id: `manual-${buildTryOnLookKeyFromItemIds(tryOnPreviewItems.map((item) => item.id)) || 'look'}`,
        style: selectedTryOnDress?.style ?? selectedTryOnTop?.style ?? selectedTryOnOuterwear?.style ?? currentLook?.style ?? 'commute',
        items: tryOnPreviewItems.map((item) => ({ item, role: item.category })),
        scores: {
          total: 0,
          weather: 0,
          style: 0,
          color: 0,
          scene: 0,
          fit: 0,
          preference: 0,
        },
        reasons: [],
        summary: selectedTryOnDress ? '这套以连衣裙为主，适合直接看整体上身效果。' : '这套已经按上衣和下装搭好了，可以直接看整套效果。',
      }
    : null
  const tryOnPreviewSession = tryOnPreviewLook ? getLookTryOnSession(tryOnPreviewLook) : null
  const tryOnPreviewImageUrl = tryOnPreviewSession ? getTryOnDisplayImageUrl(tryOnPreviewSession) : ''
  const tryOnPreviewIsOutfitGeneration = Boolean(tryOnPreviewSession?.lookKey?.startsWith('outfit:'))
  const tryOnPreviewLookKey = tryOnPreviewLook ? buildLookTryOnKey(tryOnPreviewLook) : ''
  const tryOnPreviewOutfitKey = tryOnPreviewLook ? buildOutfitGenerationKey(tryOnPreviewLook) : ''
  const isGeneratingTryOnPreview = Boolean(tryOnCreating && tryOnPreviewLookKey && tryOnPreviewingId === tryOnPreviewLookKey)
  const isGeneratingOutfitPreview = Boolean(
    tryOnCreating && tryOnPreviewOutfitKey && tryOnPreviewingId === `outfit-${tryOnPreviewOutfitKey}`,
  )
  const tryOnGenerationMode: 'tryon' | 'outfit' = needsOutfitGeneration ? 'outfit' : 'tryon'
  const currentTryOnGenerationMessage =
    isGeneratingOutfitPreview || isGeneratingTryOnPreview ? '正在生成效果图，通常需要几秒到 20 秒。' : ''
  const canGenerateSelectedTryOn = Boolean(
    avatarProfile.tryOnPhotoUrl &&
      hasManualTryOnBase &&
      !tryOnOuterwearBlocked &&
      !tryOnShoesBlocked &&
      tryOnGarmentItems.every((item) => tryOnReadyItems.some((readyItem) => readyItem.id === item.id)),
  )
  const canGenerateOutfitPreview = Boolean(
    tryOnCapabilities.supportsOutfitGeneration &&
    avatarProfile.tryOnPhotoUrl &&
      hasManualTryOnBase &&
      tryOnPreviewItems.every((item) => tryOnSelectableItems.some((selectableItem) => selectableItem.id === item.id)),
  )
  const canRunPrimaryTryOnAction = tryOnGenerationMode === 'outfit' ? canGenerateOutfitPreview : canGenerateSelectedTryOn
  const primaryTryOnActionLabel =
    isGeneratingOutfitPreview || isGeneratingTryOnPreview
      ? '生成中…'
      : tryOnPreviewImageUrl
        ? '重新生成效果图'
        : '生成效果图'
  const selectedTryOnBlockingMessage = !avatarProfile.tryOnPhotoUrl
    ? '先去“我的”里上传本人参考照。'
    : !hasManualTryOnBase
      ? '先选好一套基础搭配，至少要有连衣裙，或者上衣加下装。'
      : needsOutfitGeneration && !tryOnCapabilities.supportsOutfitGeneration
        ? '这套暂时还不能直接生成效果图，先把外套或鞋子去掉试试。'
      : tryOnOuterwearBlocked
        ? '这套暂时还不能直接生成效果图，先把外套去掉试试。'
      : tryOnShoesBlocked
        ? '这套暂时还不能直接生成效果图，先把鞋子去掉试试。'
        : canRunPrimaryTryOnAction
        ? tryOnPreviewImageUrl
          ? '这套已经有结果了，不满意的话可以直接重新生成。'
          : '这套已经可以直接生成效果图了。'
        : '这套里还有衣物资料没补全，先去衣橱把图片和标签整理好。'
  const recentTryOnSessions = tryOnSessions.slice(0, 6)
  const handleSelectAlternativeLook = (lookId: string) => {
    setCustomLook(null)
    const nextIndex = recommendations.findIndex((entry) => entry.id === lookId)
    if (nextIndex >= 0) setRecommendationIndex(nextIndex)
  }
  const handlePrimaryTryOnAction = () => {
    if (!tryOnPreviewLook) return
    if (tryOnGenerationMode === 'outfit') {
      void handleGenerateCurrentOutfitPreview(tryOnPreviewLook)
      return
    }
    void handleGenerateCurrentLookTryOn(tryOnPreviewLook)
  }
  const handleAddQuickEditHint = () => {
    document.getElementById('add-item-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setFeedback(buildFeedbackCopy('quick_edit_hint', `quick-edit-${addForm.imageUrl || 'none'}`))
  }

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
          <h1>先登录，后面这些搭配和衣橱才留得住</h1>
          <p className="auth-copy">现在是手机优先版本，登录后你的衣橱、偏好和穿着记录都会跟着手机号走，换个时间再回来也接得上。</p>

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
            <strong>当前提示</strong>
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
      {apiMessage ? <div className="api-banner">{apiMessage}</div> : null}

      <main className="content">
        {bootstrapLoading ? (
          <section className="page">
            <div className="empty-block">
              <h2>正在把今天这套思路理出来</h2>
              <p>衣橱、收藏和历史记录正在接回，很快就能看到今天的主推荐。</p>
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
            <section className="weather-panel weather-panel-compact">
              <div className="weather-top">
                <div>
                  <p className="brand">智能衣橱</p>
                  <h2>今天穿什么，先看这里</h2>
                </div>
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
              </div>
            </section>

            <div className="weather-panel">
              <div className="weather-top">
                <div>
                  <p className="eyebrow">{forecastDayLabels[forecastDay]}</p>
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
              <div className="weather-stats">
                <span>体感 {forecastWeather.feelsLike}°C</span>
                <span>温差 {forecastWeather.tempGap}°C</span>
                <span>降雨 {forecastWeather.rainProbability}%</span>
                <span>湿度 {forecastWeather.humidity}%</span>
              </div>
              <p className="weather-tip">{buildForecastTip(forecastWeather, forecastDay)}</p>
              {weatherError ? <p className="weather-error">{weatherError}</p> : null}
            </div>

            <section className="scene-strip" aria-label="快捷切换场景">
              {homeSceneTabs.map(({ value, label }) => (
                <button key={value} className={scene === value ? 'active' : ''} onClick={() => setScene(value)}>
                  {label}
                </button>
              ))}
            </section>

            <HomeRecommendationSection
              alternativeLooks={alternativeLooks}
              activeReplaceCategory={activeReplaceCategory}
              currentLook={currentLook}
              forecastDayLabel={forecastDayLabel}
              forecastWeather={forecastWeather}
              onSelectTweak={handleSelectRecommendationTweak}
              onSelectReplaceCategory={setReplaceCategory}
              recommendationTweak={recommendationTweak}
              renderItemVisual={renderItemVisual}
              renderLookCard={renderLookCard}
              renderReplacePreview={renderReplacePreview}
              replacementOptions={replacementOptions}
              replaceCategory={replaceCategory}
              replaceableCategories={replaceableCategories}
              scene={scene}
              buildHomeSummaryHighlight={buildHomeSummaryHighlight}
              buildEmptyReplacementCopy={buildEmptyReplacementCopy}
              pickToneVariant={pickToneVariant}
              setRecommendationIndexByLookId={handleSelectAlternativeLook}
              setReplaceCategory={setReplaceCategory}
            />
          </section>
        ) : null}

        {!bootstrapLoading && activeTab === 'wardrobe' ? (
          <section className="page">
            <div className="section-head">
              <h2>衣橱管理</h2>
              <p>把常穿单品整理顺手，后面每天出门前就能更快拿到稳妥推荐。</p>
            </div>

            <WardrobeFilterPanel
              filters={filters}
              hasActiveWardrobeFilters={hasActiveWardrobeFilters}
              setFilters={setFilters}
            />

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
              <WardrobeEditorPanel
                applyWardrobeEditSmartDraft={applyWardrobeEditSmartDraft}
                editImageHint={editImageHint}
                editImagePreparing={editImagePreparing}
                editImagePreset={editImagePreset}
                editRawImageUrl={editRawImageUrl}
                editSmartDraft={editSmartDraft}
                editingWardrobeItem={editingWardrobeItem}
                handleApplyWardrobeEditPreset={handleApplyWardrobeEditPreset}
                handleRemoveWardrobeEditImage={handleRemoveWardrobeEditImage}
                handleSaveWardrobeEdit={handleSaveWardrobeEdit}
                handleWardrobeEditImageUpload={handleWardrobeEditImageUpload}
                onCancel={() => {
                  setWardrobeEdit(null)
                  setEditRawImageUrl('')
                  setEditImagePreset('studio')
                  setEditImageHint('换图会先直接显示原图，后面再继续补标签；想要更干净的展示图时再开主体提取。')
                }}
                setWardrobeEdit={setWardrobeEdit}
                subjectCutEnabled={subjectCutEnabled}
                wardrobeEdit={wardrobeEdit}
                wardrobeSaving={wardrobeSaving}
              />
            ) : null}

            {focusedWardrobeItem ? (
              <WardrobeDetailCard
                focusedWardrobeItem={focusedWardrobeItem}
                isEditingCurrentItem={wardrobeEdit?.id === focusedWardrobeItem.id}
                onClose={() => setWardrobeFocusId(null)}
                onDelete={handleDeleteItem}
                onEdit={openWardrobeEditor}
                renderItemVisual={renderItemVisual}
              />
            ) : null}

            <div className="wardrobe-grid">
              {filteredWardrobe.map((item) => (
                <article className="wardrobe-card" key={item.id}>
                  <div className="wardrobe-card-visual">
                    {renderItemVisual(item)}
                    <div className="wardrobe-card-meta">
                      <span className="item-badge">{categoryLabels[item.category]}</span>
                      <span className="item-badge subtle">{item.wearCount > 0 ? `穿过 ${item.wearCount} 次` : '新加入'}</span>
                    </div>
                  </div>
                  <div className="wardrobe-copy">
                    <strong>{item.name}</strong>
                    <p>
                      {colorLabels[item.colorGroup]} / {styleLabels[item.style]} / {seasonLabels[item.seasonFit]}
                    </p>
                    <small>{item.lastWornAt ? `最近穿过 ${item.lastWornAt}` : '还没留下穿着记录'}</small>
                  </div>
                  <div className="wardrobe-card-actions">
                    <button className="primary" onClick={() => setWardrobeFocusId(item.id)}>
                      看这件
                    </button>
                    <button className="ghost" onClick={() => openWardrobeEditor(item)}>
                      编辑
                    </button>
                    <button className="ghost danger" onClick={() => handleDeleteItem(item.id)}>
                      删除
                    </button>
                  </div>
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
          <AddItemPanel
            addForm={addForm}
            batchExtractionCompleted={batchExtractionCompleted}
            batchExtractionCurrentName={batchExtractionCurrentName}
            batchExtractionItems={batchExtractionItems}
            batchExtractionProgress={batchExtractionProgress}
            batchExtractionSelectedId={batchExtractionSelectedId}
            batchExtractionTotal={batchExtractionTotal}
            canQuickConfirmAdd={canQuickConfirmAdd}
            currentPreviewMethod={currentPreviewMethod}
            handleAddItem={handleAddItem}
            handleApplyPreset={handleApplyPreset}
            handleClearAddImage={handleClearAddImage}
            handleImageUpload={handleImageUpload}
            imageHint={imageHint}
            imagePreparing={imagePreparing}
            imagePreset={imagePreset}
            itemSaving={itemSaving}
            onApplySmartDraft={applySmartDraft}
            onOpenAddIntake={openAddIntake}
            onPickBatchItem={(id) => {
              const item = batchExtractionItems.find((entry) => entry.id === id)
              if (item) applyBatchExtractionItem(item)
            }}
            preferredAddIntake={preferredAddIntake}
            previewBackdrop={previewBackdrop}
            rawImageUrl={rawImageUrl}
            setAddForm={setAddForm}
            setFeedbackToEditHint={handleAddQuickEditHint}
            setPreviewBackdrop={setPreviewBackdrop}
            setSubjectCutEnabled={setSubjectCutEnabled}
            smartDraft={smartDraft}
            subjectCutEnabled={subjectCutEnabled}
          />
        ) : null}

        {!bootstrapLoading && activeTab === 'tryon' ? (
          <section className="page profile-page">
            <div className="section-head">
              <h2>试穿效果</h2>
              <p>这里直接看当前整套，不再单独挑一件去试。</p>
            </div>

            <div className="profile-grid">
              <TryOnBuilderCard
                canRunPrimaryTryOnAction={canRunPrimaryTryOnAction}
                currentLook={currentLook}
                currentTryOnGenerationMessage={currentTryOnGenerationMessage}
                effectiveTryOnSelection={effectiveTryOnSelection}
                handleClearTryOnSelection={handleClearTryOnSelection}
                handleFillTryOnFromCurrentLook={handleFillTryOnFromCurrentLook}
                handlePrimaryTryOnAction={handlePrimaryTryOnAction}
                primaryTryOnActionLabel={primaryTryOnActionLabel}
                renderLookStage={renderLookStage}
                renderTryOnSlotField={renderTryOnSlotField}
                scene={scene}
                selectedTryOnBlockingMessage={selectedTryOnBlockingMessage}
                tryOnCreating={tryOnCreating}
                tryOnGarmentItems={tryOnGarmentItems}
                tryOnPreviewImageUrl={tryOnPreviewImageUrl}
                tryOnPreviewIsOutfitGeneration={tryOnPreviewIsOutfitGeneration}
                tryOnPreviewItems={tryOnPreviewItems}
                tryOnPreviewLook={tryOnPreviewLook}
                tryOnReadiness={tryOnReadiness}
                tryOnSlotOptions={tryOnSlotOptions}
              />

              <TryOnResultsSection
                recentTryOnSessions={recentTryOnSessions}
                tryOnSessionsCount={tryOnSessions.length}
                tryOnPreviewingId={tryOnPreviewingId}
                wardrobeItemMap={wardrobeItemMap}
                onOpenPreview={setPreviewingTryOnSession}
                onRegenerate={(id) => handleCreateMockPreview(id)}
              />
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
              <ProfileSettingsPanel
                avatarPhotoUploading={avatarPhotoUploading}
                avatarProfile={avatarProfile}
                avatarSaving={avatarSaving}
                favoriteLooksCount={favoriteLooks.length}
                handleLogout={handleLogout}
                handleSaveAvatarProfile={handleSaveAvatarProfile}
                handleTryOnPhotoUpload={handleTryOnPhotoUpload}
                historyLooksCount={historyLooks.length}
                openTryOnPhotoPicker={openTryOnPhotoPicker}
                preferences={preferences}
                session={session}
                setScene={setScene}
                tryOnReadiness={tryOnReadiness}
                updateAvatarField={updateAvatarField}
                updatePreferences={updatePreferences}
                wardrobeCount={wardrobe.length}
              />
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

