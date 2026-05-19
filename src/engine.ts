import type {
  ClothingCategory,
  ColorGroup,
  RecommendationLook,
  ReplaceCategory,
  Scene,
  StyleTag,
  UserPreferences,
  WardrobeItem,
  WeatherProfile,
} from './types'

interface CandidateLook {
  id: string
  style: StyleTag
  items: WardrobeItem[]
}

const styleMatrix: Record<StyleTag, Record<StyleTag, number>> = {
  commute: { commute: 100, refined: 90, casual: 70 },
  casual: { commute: 70, refined: 60, casual: 100 },
  refined: { commute: 85, refined: 100, casual: 60 },
}

const baseColors = new Set<ColorGroup>(['black_white_gray', 'blue', 'khaki_brown', 'denim'])

const sceneTargetStyles: Record<Scene, StyleTag[]> = {
  commute: ['commute', 'refined'],
  daily: ['casual', 'commute'],
  date: ['refined', 'commute'],
  formal: ['commute', 'refined'],
}

const sceneSummary: Record<Scene, string> = {
  commute: '更适合工作日稳妥出门',
  daily: '整套更轻松耐穿',
  date: '更有精致感，不会太用力',
  formal: '更利落克制，适合正式场景',
}

export function generateRecommendations(
  wardrobe: WardrobeItem[],
  preferences: UserPreferences,
  weather: WeatherProfile,
  scene: Scene,
): RecommendationLook[] {
  const pool = filterAvailableItems(wardrobe, preferences, weather, scene)
  const candidates = buildCandidates(pool, weather, preferences, scene)

  const scored = candidates
    .map((candidate, index) => scoreCandidate(candidate, preferences, weather, scene, index))
    .filter((look): look is RecommendationLook => Boolean(look))
    .sort((a, b) => b.scores.total - a.scores.total)

  return dedupeLooks(scored).slice(0, 6)
}

export function replaceLookItem(
  look: RecommendationLook,
  category: ReplaceCategory,
  wardrobe: WardrobeItem[],
  preferences: UserPreferences,
  weather: WeatherProfile,
  scene: Scene,
): RecommendationLook | null {
  const current = look.items.find((entry) => entry.item.category === category)?.item
  if (!current) return null

  const pool = filterAvailableItems(wardrobe, preferences, weather, scene).filter(
    (item) => item.category === category && item.id !== current.id,
  )

  const otherItems = look.items.map((entry) => entry.item).filter((item) => item.category !== category)

  const replacementCandidates = pool
    .map((item, index) =>
      scoreCandidate(
        {
          id: `${look.id}-replace-${item.id}`,
          style: inferDominantStyle([...otherItems, item], scene),
          items: [...otherItems, item],
        },
        preferences,
        weather,
        scene,
        index,
      ),
    )
    .filter((entry): entry is RecommendationLook => Boolean(entry))
    .sort((a, b) => b.scores.total - a.scores.total)

  return replacementCandidates[0] ?? null
}

function filterAvailableItems(
  wardrobe: WardrobeItem[],
  preferences: UserPreferences,
  weather: WeatherProfile,
  scene: Scene,
) {
  return wardrobe.filter((item) => {
    if (item.isDisliked) return false
    if (preferences.avoidCategories.includes(item.category)) return false
    if (preferences.avoidColors.includes(item.colorGroup)) return false
    if (!matchesWeather(item, weather)) return false
    if (!matchesScene(item, scene)) return false
    return true
  })
}

function matchesWeather(item: WardrobeItem, weather: WeatherProfile) {
  if (item.seasonFit === 'summer' && weather.feelsLike <= 12) return false
  if (item.seasonFit === 'winter' && weather.feelsLike >= 26) return false
  if (item.seasonFit === 'spring_autumn' && (weather.feelsLike <= 6 || weather.feelsLike >= 30)) return false
  if (weather.feelsLike >= 26 && item.thickness === 'warm') return false
  if (weather.feelsLike > 30 && item.category === 'outerwear') return false
  if (weather.feelsLike <= 10 && item.category !== 'shoes' && item.thickness === 'light') return false
  if (weather.rainProbability >= 50 && item.category === 'shoes' && item.colorGroup === 'khaki_brown') return false
  return true
}

function matchesScene(item: WardrobeItem, scene: Scene) {
  if (scene === 'formal' && item.style === 'casual') return false
  if (scene === 'commute' && item.style === 'casual' && item.category !== 'shoes') return false
  return true
}

function buildCandidates(
  items: WardrobeItem[],
  weather: WeatherProfile,
  preferences: UserPreferences,
  scene: Scene,
): CandidateLook[] {
  const tops = items.filter((item) => item.category === 'top')
  const bottoms = items.filter((item) => item.category === 'bottom')
  const outerwear = items.filter((item) => item.category === 'outerwear')
  const shoes = items.filter((item) => item.category === 'shoes')
  const dresses = items.filter((item) => item.category === 'dress')
  const accessories = items.filter((item) => item.category === 'accessory')
  const needsOuterwear = weather.tempGap >= 7 || weather.feelsLike <= 18 || weather.windLevel === 'high'
  const looks: CandidateLook[] = []

  const pushLookWithAccessories = (baseItems: WardrobeItem[]) => {
    const baseLook: CandidateLook = {
      id: baseItems.map((item) => item.id).join('-'),
      style: inferDominantStyle(baseItems, scene),
      items: baseItems,
    }

    looks.push(baseLook)

    const matchedAccessories = accessories
      .filter((item) => item.style === baseLook.style || item.colorGroup === baseItems[0]?.colorGroup || item.preferenceScore >= 78)
      .sort((a, b) => scoreAccessoryForLook(b, baseItems, scene) - scoreAccessoryForLook(a, baseItems, scene))
      .slice(0, 2)

    for (const accessory of matchedAccessories) {
      looks.push({
        id: `${baseLook.id}-${accessory.id}`,
        style: inferDominantStyle([...baseItems, accessory], scene),
        items: [...baseItems, accessory],
      })
    }
  }

  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        pushLookWithAccessories([top, bottom, shoe])

        if (needsOuterwear && preferences.acceptsLayering) {
          for (const coat of outerwear) {
            pushLookWithAccessories([top, bottom, coat, shoe])
          }
        }
      }
    }
  }

  for (const dress of dresses) {
    for (const shoe of shoes) {
      pushLookWithAccessories([dress, shoe])

      if (needsOuterwear && preferences.acceptsLayering) {
        for (const coat of outerwear) {
          pushLookWithAccessories([dress, coat, shoe])
        }
      }
    }
  }

  return looks
}

function inferDominantStyle(items: WardrobeItem[], scene: Scene): StyleTag {
  const counts = new Map<StyleTag, number>()
  for (const item of items) {
    counts.set(item.style, (counts.get(item.style) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? sceneTargetStyles[scene][0]
}

function scoreAccessoryForLook(accessory: WardrobeItem, baseItems: WardrobeItem[], scene: Scene) {
  let score = 0
  const dominant = inferDominantStyle(baseItems, scene)
  if (accessory.style === dominant) score += 8
  if (baseItems.some((item) => item.colorGroup === accessory.colorGroup)) score += 6
  if (accessory.preferenceScore >= 80) score += 4
  if (accessory.colorGroup === 'accent' && baseItems.some((item) => item.colorGroup === 'accent')) score -= 12
  return score
}

function scoreCandidate(
  candidate: CandidateLook,
  preferences: UserPreferences,
  weather: WeatherProfile,
  scene: Scene,
  index: number,
): RecommendationLook | null {
  const categories = candidate.items.map((item) => item.category)
  if (!hasRequiredCategories(categories) || new Set(candidate.items.map((item) => item.style)).size > 2 || !styleDeviationIsSafe(candidate.items)) {
    return null
  }

  const weatherScore = scoreWeather(candidate.items, weather)
  const styleScore = scoreStyle(candidate.items, scene)
  const colorScore = scoreColor(candidate.items)
  const sceneScore = scoreScene(candidate.items, scene)
  const fitScore = scoreFit(candidate.items, scene)
  const preference = scorePreference(candidate.items, preferences)

  const total =
    weatherScore * 0.3 +
    styleScore * 0.25 +
    colorScore * 0.2 +
    sceneScore * 0.15 +
    fitScore * 0.1 +
    preference

  return {
    id: `${candidate.id}-${index}`,
    style: candidate.style,
    items: candidate.items.map((item) => ({ item, role: item.category })),
    scores: {
      total: Number(total.toFixed(1)),
      weather: weatherScore,
      style: styleScore,
      color: colorScore,
      scene: sceneScore,
      fit: fitScore,
      preference,
    },
    reasons: buildReasons(candidate.items, candidate.style, preferences, weather, scene),
    summary: sceneSummary[scene],
  }
}

function hasRequiredCategories(categories: ClothingCategory[]) {
  const set = new Set(categories)
  return (set.has('dress') && set.has('shoes')) || (set.has('top') && set.has('bottom') && set.has('shoes'))
}

function styleDeviationIsSafe(items: WardrobeItem[]) {
  const counts = new Map<StyleTag, number>()
  for (const item of items) {
    counts.set(item.style, (counts.get(item.style) ?? 0) + 1)
  }
  const sorted = [...counts.values()].sort((a, b) => b - a)
  return (sorted[0] ?? 0) >= items.length - 1
}

function scoreWeather(items: WardrobeItem[], weather: WeatherProfile) {
  let score = 72
  const hasOuterwear = items.some((item) => item.category === 'outerwear')
  const hasWarmItem = items.some((item) => item.thickness === 'warm')
  const practicalItems = items.filter((item) => item.category !== 'accessory')
  const lightCount = practicalItems.filter((item) => item.thickness === 'light').length
  const seasonBonus = items.reduce((sum, item) => {
    if (item.category === 'accessory') return sum + 1
    if (item.seasonFit === 'all_season') return sum + 2
    if (item.seasonFit === 'summer' && weather.feelsLike >= 24) return sum + 4
    if (item.seasonFit === 'winter' && weather.feelsLike <= 12) return sum + 4
    if (item.seasonFit === 'spring_autumn' && weather.feelsLike > 12 && weather.feelsLike < 24) return sum + 3
    return sum - 2
  }, 0)

  if (weather.feelsLike <= 10) score += hasWarmItem ? 18 : -20
  if (weather.feelsLike >= 25) score += lightCount >= 2 ? 15 : -10
  if (weather.tempGap >= 7) score += hasOuterwear ? 12 : -8
  if (weather.windLevel === 'high') score += hasOuterwear ? 10 : -6
  if (weather.humidity >= 75 && items.some((item) => item.thickness === 'warm')) score -= 12
  score += seasonBonus

  return clamp(score)
}

function scoreStyle(items: WardrobeItem[], scene: Scene) {
  const dominant = inferDominantStyle(items, scene)
  const itemScores = items.map((item) => styleMatrix[dominant][item.style])
  const average = itemScores.reduce((sum, value) => sum + value, 0) / itemScores.length
  return clamp(average)
}

function scoreColor(items: WardrobeItem[]) {
  const colorGroups = items.map((item) => item.colorGroup)
  const uniqueCount = new Set(colorGroups).size
  let score = 78

  if (uniqueCount <= 2) score += 18
  else if (uniqueCount === 3) score += 8
  else score -= 15

  const accentCount = colorGroups.filter((group) => group === 'accent').length
  if (accentCount > 1) score -= 20
  if (colorGroups.every((group) => baseColors.has(group))) score += 8
  if (colorGroups.includes('black_white_gray') && uniqueCount <= 3) score += 6
  if (items.some((item) => item.category === 'accessory') && uniqueCount <= 3) score += 4

  return clamp(score)
}

function scoreScene(items: WardrobeItem[], scene: Scene) {
  const targets = sceneTargetStyles[scene]
  let score = 70
  for (const item of items) {
    if (item.category === 'accessory') {
      score += item.style === targets[0] ? 7 : item.style === targets[1] ? 5 : -4
      continue
    }
    if (item.style === targets[0]) score += 10
    else if (item.style === targets[1]) score += 6
    else score -= 6
  }
  return clamp(score)
}

function scoreFit(items: WardrobeItem[], scene: Scene) {
  const top = items.find((item) => item.category === 'top')
  const bottom = items.find((item) => item.category === 'bottom')
  if (!top || !bottom) return 84

  if (
    (top.fitType === 'relaxed' && bottom.fitType === 'slim') ||
    (top.fitType === 'slim' && bottom.fitType === 'relaxed')
  ) {
    return 95
  }
  if (top.fitType === 'regular' && bottom.fitType === 'regular') return 85
  if (top.fitType === 'relaxed' && bottom.fitType === 'relaxed') return scene === 'daily' ? 75 : 64
  if (top.fitType === 'slim' && bottom.fitType === 'slim') return 75
  return 80
}

function scorePreference(items: WardrobeItem[], preferences: UserPreferences) {
  let score = 0
  for (const item of items) {
    if (item.category === 'accessory') {
      score += preferences.preferredStyles.includes(item.style) ? 2.5 : 0
      score += (item.preferenceScore - 70) / 14
      continue
    }
    if (preferences.preferredStyles.includes(item.style)) score += 3.5
    score += (item.preferenceScore - 70) / 10
    if (preferences.avoidRepeatLooks && item.lastWornAt === '2026-05-13') score -= 5
  }

  if (preferences.comfortPriority === 'lightness_first') {
    score += items.filter((item) => item.thickness === 'light').length * 2
  }
  if (preferences.comfortPriority === 'warmth_first') {
    score += items.filter((item) => item.thickness === 'warm').length * 2
  }

  return Number(score.toFixed(1))
}

function buildReasons(
  items: WardrobeItem[],
  style: StyleTag,
  preferences: UserPreferences,
  weather: WeatherProfile,
  scene: Scene,
) {
  const reasons: string[] = []

  if (weather.tempGap >= 7 && items.some((item) => item.category === 'outerwear')) {
    reasons.push(`今天体感 ${weather.feelsLike}°C，早晚温差明显，轻外套会更稳妥。`)
  } else if (weather.feelsLike >= 28) {
    reasons.push('今天偏热，这套优先用了更轻薄透气的单品。')
  } else {
    reasons.push('今天体感温和，这套厚薄更适合直接出门。')
  }

  const styleLabel = style === 'commute' ? '通勤' : style === 'casual' ? '休闲' : '精致'
  if (preferences.preferredStyles.includes(style)) {
    reasons.push(`你最近更偏好${styleLabel}风，这套接受度会更高。`)
  } else {
    reasons.push(sceneSummary[scene])
  }

  if (weather.rainProbability >= 50) {
    reasons.push('已经尽量避开不稳妥的鞋款，雨天会更省心。')
  }

  if (items.some((item) => item.category === 'accessory')) {
    reasons.push('这套额外留了一个点睛配饰位，上身会更完整一些。')
  }

  return reasons.slice(0, 3)
}

function dedupeLooks(looks: RecommendationLook[]) {
  const seen = new Set<string>()
  return looks.filter((look) => {
    const key = look.items
      .map((entry) => `${entry.role}:${entry.item.id}`)
      .sort()
      .join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(1))))
}
