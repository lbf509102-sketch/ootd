import type {
  BodyShape,
  ClothingCategory,
  ColorGroup,
  ComfortPriority,
  FitType,
  GarmentLength,
  GenderPresentation,
  HipType,
  LegLengthType,
  Scene,
  SeasonFit,
  ShoulderType,
  Silhouette,
  SleeveLength,
  StyleTag,
  TabId,
  Thickness,
  WeatherProfile,
  WaistType,
} from './types'

export const fixedCityList = ['嘉兴', '宁波', '嵊州 / 新昌'] as const

export const fixedCityWeatherOptions: Record<(typeof fixedCityList)[number], WeatherProfile> = {
  嘉兴: {
    city: '嘉兴',
    temperature: 25,
    feelsLike: 26,
    weatherType: 'cloudy',
    windLevel: 'medium',
    humidity: 72,
    uvLevel: 'medium',
    tempGap: 7,
    rainProbability: 30,
  },
  宁波: {
    city: '宁波',
    temperature: 26,
    feelsLike: 28,
    weatherType: 'cloudy',
    windLevel: 'medium',
    humidity: 76,
    uvLevel: 'medium',
    tempGap: 6,
    rainProbability: 35,
  },
  '嵊州 / 新昌': {
    city: '嵊州 / 新昌',
    temperature: 25,
    feelsLike: 27,
    weatherType: 'cloudy',
    windLevel: 'low',
    humidity: 74,
    uvLevel: 'medium',
    tempGap: 6,
    rainProbability: 28,
  },
}

export const tabLabels: Record<TabId, string> = {
  home: '首页',
  wardrobe: '衣橱',
  add: '录入',
  tryon: '试穿',
  profile: '我的',
}

export const sceneLabels: Record<Scene, string> = {
  commute: '通勤',
  daily: '日常',
  date: '约会',
  formal: '正式',
}

export const homeSceneTabs: Array<{ value: Scene; label: string }> = [
  { value: 'commute', label: '通勤' },
  { value: 'daily', label: '日常' },
  { value: 'formal', label: '场合' },
]

export const styleLabels: Record<StyleTag, string> = {
  commute: '通勤',
  casual: '休闲',
  refined: '精致',
}

export const categoryLabels: Record<ClothingCategory, string> = {
  top: '上衣',
  bottom: '下装',
  outerwear: '外套',
  shoes: '鞋子',
  dress: '连衣裙',
  accessory: '配饰',
}

export const colorLabels: Record<ColorGroup, string> = {
  black_white_gray: '黑白灰',
  blue: '蓝色',
  khaki_brown: '卡其棕',
  denim: '牛仔',
  accent: '亮色',
}

export const thicknessLabels: Record<Thickness, string> = {
  light: '轻薄',
  regular: '常规',
  warm: '保暖',
}

export const seasonLabels: Record<SeasonFit, string> = {
  summer: '夏季',
  spring_autumn: '春秋',
  winter: '冬季',
  all_season: '四季',
}

export const fitTypeLabels: Record<FitType, string> = {
  slim: '修身',
  regular: '常规',
  relaxed: '宽松',
}

export const garmentLengthLabels: Record<GarmentLength, string> = {
  short: '短款',
  regular: '常规',
  long: '长款',
  midi: '中长',
  maxi: '超长',
}

export const sleeveLengthLabels: Record<SleeveLength, string> = {
  sleeveless: '无袖',
  short: '短袖',
  three_quarter: '七分袖',
  long: '长袖',
  na: '不适用',
}

export const silhouetteLabels: Record<Silhouette, string> = {
  fitted: '贴身',
  straight: '直筒',
  relaxed: '宽松',
  a_line: 'A 字',
}

export const comfortOptions: Record<ComfortPriority, string> = {
  warmth_first: '保暖优先',
  lightness_first: '轻便优先',
  slimming_first: '显瘦优先',
  versatile_first: '百搭优先',
}

export const genderPresentationLabels: Record<GenderPresentation, string> = {
  feminine: '偏女性化',
  masculine: '偏男性化',
  neutral: '中性',
}

export const bodyShapeLabels: Record<BodyShape, string> = {
  balanced: '匀称',
  pear: '梨形',
  apple: '苹果型',
  rectangle: 'H 型',
  inverted_triangle: '倒三角',
  hourglass: '沙漏型',
}

export const shoulderTypeLabels: Record<ShoulderType, string> = {
  narrow: '偏窄',
  regular: '常规',
  broad: '偏宽',
}

export const waistTypeLabels: Record<WaistType, string> = {
  defined: '明显',
  regular: '常规',
  soft: '偏柔和',
}

export const hipTypeLabels: Record<HipType, string> = {
  narrow: '偏窄',
  regular: '常规',
  curvy: '偏丰满',
}

export const legLengthLabels: Record<LegLengthType, string> = {
  shorter: '偏短',
  regular: '常规',
  longer: '偏长',
}
