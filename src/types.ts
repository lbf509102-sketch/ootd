export type TabId = 'home' | 'wardrobe' | 'add' | 'tryon' | 'profile'

export type ClothingCategory = 'top' | 'bottom' | 'outerwear' | 'shoes' | 'dress' | 'accessory'
export type ColorGroup =
  | 'black_white_gray'
  | 'blue'
  | 'khaki_brown'
  | 'denim'
  | 'accent'
export type Thickness = 'light' | 'regular' | 'warm'
export type StyleTag = 'commute' | 'casual' | 'refined'
export type ItemStatus = 'ready' | 'dirty'
export type SeasonFit = 'summer' | 'spring_autumn' | 'winter' | 'all_season'
export type FitType = 'slim' | 'regular' | 'relaxed'
export type Scene = 'commute' | 'daily' | 'date' | 'formal'
export type ComfortPriority =
  | 'warmth_first'
  | 'lightness_first'
  | 'slimming_first'
  | 'versatile_first'
export type ReplaceCategory = ClothingCategory
export type GarmentLength = 'short' | 'regular' | 'long' | 'midi' | 'maxi'
export type SleeveLength = 'sleeveless' | 'short' | 'three_quarter' | 'long' | 'na'
export type Silhouette = 'fitted' | 'straight' | 'relaxed' | 'a_line'
export type GenderPresentation = 'feminine' | 'masculine' | 'neutral'
export type BodyShape =
  | 'balanced'
  | 'pear'
  | 'apple'
  | 'rectangle'
  | 'inverted_triangle'
  | 'hourglass'
export type ShoulderType = 'narrow' | 'regular' | 'broad'
export type WaistType = 'defined' | 'regular' | 'soft'
export type HipType = 'narrow' | 'regular' | 'curvy'
export type LegLengthType = 'shorter' | 'regular' | 'longer'

export interface WardrobeItem {
  id: string
  name: string
  category: ClothingCategory
  colorGroup: ColorGroup
  thickness: Thickness
  style: StyleTag
  status: ItemStatus
  seasonFit: SeasonFit
  fitType: FitType
  garmentLength?: GarmentLength
  sleeveLength?: SleeveLength
  silhouette?: Silhouette
  preferenceScore: number
  wearCount: number
  createdAt?: string
  lastWornAt?: string
  isDisliked: boolean
  imageUrl?: string | null
  displayImageUrl?: string | null
  sourceImageUrl?: string | null
}

export interface UserPreferences {
  preferredStyles: StyleTag[]
  avoidCategories: ClothingCategory[]
  avoidColors: ColorGroup[]
  comfortPriority: ComfortPriority
  defaultScene: Scene
  acceptsLayering: boolean
  avoidRepeatLooks: boolean
}

export interface WeatherProfile {
  city: string
  temperature: number
  feelsLike: number
  weatherType: 'sunny' | 'cloudy' | 'rainy' | 'windy'
  windLevel: 'low' | 'medium' | 'high'
  humidity: number
  uvLevel: 'low' | 'medium' | 'high'
  tempGap: number
  rainProbability: number
}

export interface UserSession {
  phone: string
  nickname: string
  token: string
}

export interface AvatarProfile {
  heightCm: number
  weightKg: number
  genderPresentation: GenderPresentation
  bodyShape: BodyShape
  shoulderType: ShoulderType
  waistType: WaistType
  hipType: HipType
  legLengthType: LegLengthType
  tryOnPhotoUrl?: string | null
}

export interface CityOption {
  city: string
  latitude: number
  longitude: number
  fallbackWeather: WeatherProfile
}

export interface LookItem {
  item: WardrobeItem
  role: ClothingCategory
}

export interface RecommendationLook {
  id: string
  style: StyleTag
  items: LookItem[]
  backupOuterwear?: WardrobeItem | null
  scores: {
    total: number
    weather: number
    style: number
    color: number
    scene: number
    fit: number
    preference: number
  }
  reasons: string[]
  summary: string
}

export interface SavedLook {
  id: string
  kind: 'history' | 'favorite'
  look: RecommendationLook
  createdAt: string
}

export interface TryOnSession {
  id: string
  garmentItemId: string
  lookKey?: string | null
  personImageUrl: string
  garmentImageUrl: string
  resultImageUrl?: string | null
  baseResultImageUrl?: string | null
  provider?: 'mock' | 'webhook' | 'aliyun' | 'doubao' | 'wan'
  status: 'draft_ready' | 'processing' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  note: string
}
