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

export type RecommendationTweak = 'balanced' | 'taller' | 'cleaner' | 'hide_hips'

interface CandidateLook {
  id: string
  style: StyleTag
  items: WardrobeItem[]
  backupOuterwear?: WardrobeItem | null
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
  commute: '上班这样穿会稳一点，不容易出错。',
  daily: '这套轻松耐穿，日常出门会很省心。',
  date: '看着会更用心一点，但不会太刻意。',
  formal: '整体更利落，放到正式场合也撑得住。',
}


const recentWearPenaltyDays = 3
const categoryCandidateLimits: Record<ClothingCategory, number> = {
  top: 8,
  bottom: 8,
  outerwear: 4,
  shoes: 6,
  dress: 6,
  accessory: 4,
}

function pickVariant(seed: string, variants: string[]) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return variants[hash % variants.length] ?? variants[0] ?? ''
}

function getDaysSince(value?: string) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const parsedStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()
  return Math.max(0, Math.floor((todayStart - parsedStart) / (24 * 60 * 60 * 1000)))
}

function scoreItemForCandidatePool(
  item: WardrobeItem,
  preferences: UserPreferences,
  weather: WeatherProfile,
  scene: Scene,
) {
  let score = item.preferenceScore
  const sceneTargets = sceneTargetStyles[scene]

  if (preferences.preferredStyles.includes(item.style)) score += 10
  if (item.style === sceneTargets[0]) score += 8
  else if (item.style === sceneTargets[1]) score += 4

  if (preferences.comfortPriority === 'lightness_first' && item.thickness === 'light') score += 4
  if (preferences.comfortPriority === 'warmth_first' && item.thickness === 'warm') score += 4
  if (item.category === 'outerwear' && shouldConsiderOuterwear(weather, preferences)) score += 4
  if (item.category === 'outerwear' && shouldSuggestBackupOuterwear(weather, preferences)) score += 3

  const daysSinceWear = getDaysSince(item.lastWornAt)
  if (preferences.avoidRepeatLooks && daysSinceWear !== null) {
    if (daysSinceWear <= 1) score -= 12
    else if (daysSinceWear <= recentWearPenaltyDays) score -= 7
    else if (daysSinceWear <= recentWearPenaltyDays + 2) score -= 3
  }

  return score
}

function trimCategoryPool(
  items: WardrobeItem[],
  category: ClothingCategory,
  preferences: UserPreferences,
  weather: WeatherProfile,
  scene: Scene,
) {
  const limit = categoryCandidateLimits[category]
  if (items.length <= limit) return items

  return [...items]
    .sort(
      (left, right) =>
        scoreItemForCandidatePool(right, preferences, weather, scene) -
          scoreItemForCandidatePool(left, preferences, weather, scene) ||
        right.preferenceScore - left.preferenceScore,
    )
    .slice(0, limit)
}

function buildLookSummary(
  items: WardrobeItem[],
  weather: WeatherProfile,
  scene: Scene,
  style: StyleTag,
  backupOuterwear?: WardrobeItem | null,
) {
  const hasOuterwear = items.some((item) => item.category === 'outerwear')
  const hasDress = items.some((item) => item.category === 'dress')
  const summarySeed = `${scene}-${style}-${weather.feelsLike}-${weather.tempGap}-${hasOuterwear ? 'coat' : 'no-coat'}-${backupOuterwear ? backupOuterwear.id : 'none'}`

  if (hasOuterwear && weather.feelsLike >= 24) {
    return pickVariant(summarySeed, [
      '主穿搭先轻一点，这件外套更多是帮你压住早晚温差。',
      '整体还是走清爽路线，只是顺手叠了一件薄外套防风。',
      '这套不是为了保暖堆层次，外套只是让早晚切换更从容。',
    ])
  }

  if (backupOuterwear) {
    return pickVariant(summarySeed, [
      '主穿搭已经够用了，边上再备一件外套，早晚会更安心。',
      '白天这样穿就行，如果出门到晚上，顺手带件外套会更稳。',
      '这套白天穿很轻松，旁边那件外套主要留给温差大的时候。',
    ])
  }

  if (weather.feelsLike >= 28) {
    return pickVariant(summarySeed, [
      '今天偏热，先把轻薄和透气放在第一位。',
      '这种天气别堆太多层，清爽一点反而更高级。',
      '气温已经上来了，这套重点就是轻、松、没有负担。',
    ])
  }

  if (scene === 'formal') {
    return pickVariant(summarySeed, [
      '整体更利落，放到正式场合也能稳稳撑住。',
      '这套看起来会更有分寸，放到需要体面的场合也合适。',
      '线条和气质都比较干净，正式一点的安排也不会掉链子。',
    ])
  }

  if (hasDress) {
    return pickVariant(summarySeed, [
      '裙装已经把氛围感拉起来了，剩下的重点就是穿得轻松自然。',
      '这套的重点在裙装本身，整体不用太复杂也能成立。',
      '裙装已经够有存在感了，其他单品保持克制反而更顺眼。',
    ])
  }

  return pickVariant(summarySeed, [
    sceneSummary[scene],
    '今天这样穿会比较顺，不需要花太多心思就能出门。',
    '这套属于稳妥但不无聊的路线，直接穿也不会出错。',
  ])
}


export function generateRecommendations(
  wardrobe: WardrobeItem[],
  preferences: UserPreferences,
  weather: WeatherProfile,
  scene: Scene,
  tweak: RecommendationTweak = 'balanced',
): RecommendationLook[] {
  const pool = filterAvailableItems(wardrobe, preferences, weather, scene)
  const candidates = buildCandidates(pool, weather, preferences, scene)

  const scored = candidates
    .map((candidate, index) => scoreCandidate(candidate, preferences, weather, scene, index, tweak))
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
  tweak: RecommendationTweak = 'balanced',
): RecommendationLook | null {
  return replaceLookItems(look, category, wardrobe, preferences, weather, scene, 1, tweak)[0] ?? null
}

export function replaceLookItems(
  look: RecommendationLook,
  category: ReplaceCategory,
  wardrobe: WardrobeItem[],
  preferences: UserPreferences,
  weather: WeatherProfile,
  scene: Scene,
  limit = 3,
  tweak: RecommendationTweak = 'balanced',
): RecommendationLook[] {
  const current = look.items.find((entry) => entry.item.category === category)?.item
  if (!current) return []

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
        tweak,
      ),
    )
    .filter((entry): entry is RecommendationLook => Boolean(entry))
    .sort((a, b) => b.scores.total - a.scores.total)

  return dedupeLooks(replacementCandidates).slice(0, limit)
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
  if (weather.feelsLike >= 27 && item.category === 'outerwear') return false
  if (weather.feelsLike >= 24 && item.category === 'outerwear' && item.thickness !== 'light') return false
  if (weather.feelsLike <= 10 && item.category !== 'shoes' && item.thickness === 'light') return false
  if (weather.rainProbability >= 50 && item.category === 'shoes' && item.colorGroup === 'khaki_brown') return false
  return true
}

function matchesScene(item: WardrobeItem, scene: Scene) {
  if (scene === 'formal' && item.style === 'casual') return false
  return true
}

function shouldConsiderOuterwear(weather: WeatherProfile, preferences: UserPreferences) {
  if (!preferences.acceptsLayering) return false
  if (weather.feelsLike >= 27) return false
  if (weather.feelsLike <= 18) return true
  if (weather.feelsLike <= 23) {
    return weather.tempGap >= 6 || weather.windLevel === 'high' || weather.rainProbability >= 45
  }
  return weather.tempGap >= 9 || weather.windLevel === 'high' || weather.rainProbability >= 60
}

function shouldSuggestBackupOuterwear(weather: WeatherProfile, preferences: UserPreferences) {
  if (!preferences.acceptsLayering) return false
  if (weather.feelsLike <= 18) return false
  if (weather.feelsLike >= 30) return false
  if (weather.feelsLike >= 27) {
    return weather.tempGap >= 8 || weather.windLevel === 'high' || weather.rainProbability >= 55
  }
  return weather.tempGap >= 6 || weather.windLevel === 'high' || weather.rainProbability >= 45
}

function isOuterwearWeatherFriendly(item: WardrobeItem, weather: WeatherProfile) {
  if (item.category !== 'outerwear') return false
  if (weather.feelsLike >= 27) return false
  if (weather.feelsLike >= 24) return item.thickness === 'light'
  if (weather.feelsLike <= 12) return item.thickness !== 'light' || weather.windLevel === 'high'
  return true
}

function scoreOuterwearForWeather(item: WardrobeItem, weather: WeatherProfile, baseItems: WardrobeItem[], scene: Scene) {
  let score = 0
  const baseStyle = inferDominantStyle(baseItems, scene)

  if (item.thickness === 'light' && weather.feelsLike >= 22) score += 8
  if (item.thickness === 'regular' && weather.feelsLike >= 20 && weather.feelsLike <= 24) score += 6
  if (item.thickness === 'warm' && weather.feelsLike <= 16) score += 10
  if (weather.tempGap >= 8) score += item.thickness === 'light' ? 6 : 4
  if (weather.windLevel === 'high') score += 6
  if (weather.rainProbability >= 55) score += item.thickness === 'light' ? 5 : 2

  score += styleMatrix[baseStyle][item.style] / 10

  if (baseItems.some((baseItem) => baseItem.colorGroup === item.colorGroup)) score += 4
  if (baseItems.some((baseItem) => baseItem.style === item.style)) score += 4

  if (weather.feelsLike >= 24 && item.thickness !== 'light') score -= 14
  if (weather.feelsLike >= 22 && item.thickness === 'warm') score -= 18
  if (baseItems.some((baseItem) => baseItem.category === 'dress') && item.style === 'casual' && baseStyle === 'refined') score -= 10

  return score
}

function buildCandidates(
  items: WardrobeItem[],
  weather: WeatherProfile,
  preferences: UserPreferences,
  scene: Scene,
): CandidateLook[] {
  const tops = trimCategoryPool(
    items.filter((item) => item.category === 'top'),
    'top',
    preferences,
    weather,
    scene,
  )
  const bottoms = trimCategoryPool(
    items.filter((item) => item.category === 'bottom'),
    'bottom',
    preferences,
    weather,
    scene,
  )
  const outerwear = trimCategoryPool(
    items.filter((item) => item.category === 'outerwear'),
    'outerwear',
    preferences,
    weather,
    scene,
  )
  const shoes = trimCategoryPool(
    items.filter((item) => item.category === 'shoes'),
    'shoes',
    preferences,
    weather,
    scene,
  )
  const dresses = trimCategoryPool(
    items.filter((item) => item.category === 'dress'),
    'dress',
    preferences,
    weather,
    scene,
  )
  const accessories = trimCategoryPool(
    items.filter((item) => item.category === 'accessory'),
    'accessory',
    preferences,
    weather,
    scene,
  )
  const outerwearAllowed = shouldConsiderOuterwear(weather, preferences)
  const backupOuterwearAllowed = shouldSuggestBackupOuterwear(weather, preferences)
  const looks: CandidateLook[] = []

  const pushLookWithAccessories = (baseItems: WardrobeItem[]) => {
    const hasOuterwear = baseItems.some((item) => item.category === 'outerwear')
    const rankedBackupOuterwear =
      backupOuterwearAllowed && !hasOuterwear
        ? outerwear
            .filter((coat) => isOuterwearWeatherFriendly(coat, weather))
            .sort((a, b) => scoreOuterwearForWeather(b, weather, baseItems, scene) - scoreOuterwearForWeather(a, weather, baseItems, scene))
        : []
    const baseLook: CandidateLook = {
      id: baseItems.map((item) => item.id).join('-'),
      style: inferDominantStyle(baseItems, scene),
      items: baseItems,
      backupOuterwear: rankedBackupOuterwear[0] ?? null,
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
        const baseItems = [top, bottom, shoe]
        pushLookWithAccessories(baseItems)

        if (outerwearAllowed) {
          const rankedOuterwear = outerwear
            .filter((coat) => isOuterwearWeatherFriendly(coat, weather))
            .sort((a, b) => scoreOuterwearForWeather(b, weather, baseItems, scene) - scoreOuterwearForWeather(a, weather, baseItems, scene))
            .slice(0, 2)

          for (const coat of rankedOuterwear) {
            pushLookWithAccessories([top, bottom, coat, shoe])
          }
        }
      }
    }
  }

  for (const dress of dresses) {
    for (const shoe of shoes) {
      const baseItems = [dress, shoe]
      pushLookWithAccessories(baseItems)

      if (outerwearAllowed) {
        const rankedOuterwear = outerwear
          .filter((coat) => isOuterwearWeatherFriendly(coat, weather))
          .sort((a, b) => scoreOuterwearForWeather(b, weather, baseItems, scene) - scoreOuterwearForWeather(a, weather, baseItems, scene))
          .slice(0, 2)

        for (const coat of rankedOuterwear) {
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
  tweak: RecommendationTweak = 'balanced',
): RecommendationLook | null {
  const categories = candidate.items.map((item) => item.category)
  const maxStyleGroups = candidate.items.some((item) => item.category === 'outerwear' || item.category === 'accessory') ? 3 : 2
  if (!hasRequiredCategories(categories) || new Set(candidate.items.map((item) => item.style)).size > maxStyleGroups || !styleDeviationIsSafe(candidate.items)) {
    return null
  }

  const weatherScore = scoreWeather(candidate.items, weather)
  const styleScore = scoreStyle(candidate.items, scene)
  const colorScore = scoreColor(candidate.items)
  const sceneScore = scoreScene(candidate.items, scene)
  const fitScore = scoreFit(candidate.items, scene)
  const preference = scorePreference(candidate.items, preferences)
  const tweakScore = scoreTweak(candidate.items, tweak)

  const total =
    weatherScore * 0.3 +
    styleScore * 0.25 +
    colorScore * 0.2 +
    sceneScore * 0.15 +
    fitScore * 0.1 +
    preference +
    tweakScore

  return {
    id: `${candidate.id}-${index}`,
    style: candidate.style,
    items: candidate.items.map((item) => ({ item, role: item.category })),
    backupOuterwear: candidate.backupOuterwear ?? null,
    scores: {
      total: Number(total.toFixed(1)),
      weather: weatherScore,
      style: styleScore,
      color: colorScore,
      scene: sceneScore,
      fit: fitScore,
      preference: Number((preference + tweakScore).toFixed(1)),
    },
    reasons: buildReasons(candidate.items, candidate.style, preferences, weather, scene),
    summary: buildLookSummary(candidate.items, weather, scene, candidate.style, candidate.backupOuterwear),
  }
}

function scoreTweak(items: WardrobeItem[], tweak: RecommendationTweak) {
  if (tweak === 'balanced') return 0

  const top = items.find((item) => item.category === 'top')
  const bottom = items.find((item) => item.category === 'bottom')
  const dress = items.find((item) => item.category === 'dress')
  const outerwear = items.find((item) => item.category === 'outerwear')
  const usesDress = Boolean(dress)

  let score = 0

  if (tweak === 'taller') {
    if (bottom?.fitType === 'slim') score += 2.5
    if (bottom?.garmentLength === 'regular') score += 1.5
    if (dress?.garmentLength === 'midi') score += 2
    if (top?.garmentLength === 'short') score += 2.5
    if (outerwear?.garmentLength === 'short') score += 1.5
    if (outerwear?.garmentLength === 'long') score -= 1.5
    if (bottom?.fitType === 'relaxed') score -= 1.5
  }

  if (tweak === 'cleaner') {
    if (top?.fitType === 'regular' || top?.fitType === 'slim') score += 1.5
    if (bottom?.fitType === 'regular' || bottom?.fitType === 'slim') score += 1.5
    if (dress?.fitType === 'regular' || dress?.fitType === 'slim') score += 1.5
    if (outerwear?.style === 'commute' || outerwear?.style === 'refined') score += 1.5
    if (items.some((item) => item.style === 'casual')) score -= usesDress ? 1 : 1.5
    if (items.filter((item) => item.category === 'accessory').length > 0) score -= 0.5
  }

  if (tweak === 'hide_hips') {
    if (dress?.silhouette === 'a_line') score += 3
    if (dress?.garmentLength === 'midi' || dress?.garmentLength === 'maxi') score += 2
    if (bottom?.fitType === 'relaxed') score += 2
    if (bottom?.colorGroup === 'black_white_gray' || bottom?.colorGroup === 'blue') score += 1
    if (top?.garmentLength === 'regular' || top?.garmentLength === 'long') score += 1
    if (bottom?.fitType === 'slim') score -= 2
    if (bottom?.colorGroup === 'accent') score -= 1.5
  }

  return Number(score.toFixed(1))
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
  const tolerance = items.some((item) => item.category === 'outerwear' || item.category === 'accessory') ? 2 : 1
  return (sorted[0] ?? 0) >= items.length - tolerance
}

function scoreWeather(items: WardrobeItem[], weather: WeatherProfile) {
  let score = 72
  const outerwear = items.find((item) => item.category === 'outerwear')
  const hasOuterwear = Boolean(outerwear)
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

  if (weather.feelsLike >= 27 && hasOuterwear) {
    score -= outerwear?.thickness === 'light' ? 16 : 30
  } else if (weather.feelsLike >= 24 && hasOuterwear) {
    score += outerwear?.thickness === 'light' ? (weather.tempGap >= 9 || weather.windLevel === 'high' ? 4 : -8) : -18
  } else if (weather.feelsLike <= 18) {
    score += hasOuterwear ? 12 : -10
  } else if (weather.tempGap >= 7) {
    score += hasOuterwear ? 8 : -4
  }

  if (weather.windLevel === 'high') score += hasOuterwear ? 8 : -6
  if (weather.rainProbability >= 55 && hasOuterwear && outerwear?.thickness === 'light') score += 5
  if (weather.humidity >= 75 && items.some((item) => item.thickness === 'warm')) score -= 12
  score += seasonBonus

  return clamp(score)
}

function scoreStyle(items: WardrobeItem[], scene: Scene) {
  const dominant = inferDominantStyle(items, scene)
  const itemScores = items.map((item) => styleMatrix[dominant][item.style])
  let average = itemScores.reduce((sum, value) => sum + value, 0) / itemScores.length
  const outerwear = items.find((item) => item.category === 'outerwear')
  const dress = items.find((item) => item.category === 'dress')

  if (outerwear) {
    const baseItems = items.filter((item) => item.category !== 'outerwear' && item.category !== 'accessory')
    const baseStyle = inferDominantStyle(baseItems.length ? baseItems : items, scene)
    average += (styleMatrix[baseStyle][outerwear.style] - 80) / 2
  }

  if (dress && outerwear && dress.style === 'refined' && outerwear.style === 'casual') {
    average -= 8
  }

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
  const dress = items.find((item) => item.category === 'dress')
  const outerwear = items.find((item) => item.category === 'outerwear')

  if (!top || !bottom) {
    let dressScore = 84
    if (dress && outerwear) {
      if (dress.fitType === 'slim' && outerwear.fitType === 'relaxed') dressScore += 6
      if (dress.fitType === 'relaxed' && outerwear.fitType === 'relaxed') dressScore -= 6
      if (dress.style === 'refined' && outerwear.style === 'casual') dressScore -= 8
    }
    return clamp(dressScore)
  }

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
    const daysSinceWear = getDaysSince(item.lastWornAt)
    if (preferences.avoidRepeatLooks && daysSinceWear !== null) {
      if (daysSinceWear <= 1) score -= 5
      else if (daysSinceWear <= recentWearPenaltyDays) score -= 3
    }
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
  const hasOuterwear = items.some((item) => item.category === 'outerwear')
  const seed = `${scene}-${style}-${weather.feelsLike}-${items.map((item) => item.id).join('-')}`

  if (hasOuterwear && weather.feelsLike >= 24) {
    reasons.push(
      pickVariant(seed, [
        `今天体感 ${weather.feelsLike}°C，这件外套只是薄薄压一层，主要帮你应对风和早晚温差。`,
        '现在穿外套不是为了厚重保暖，更像是给早晚和空调房留一个缓冲。',
        '这层外套更像备用保险，不会太闷，但能把温差这件事照顾到。',
      ]),
    )
  } else if (weather.tempGap >= 7 && hasOuterwear) {
    reasons.push(
      pickVariant(seed, [
        `今天体感 ${weather.feelsLike}°C，早晚有点温差，带件外套会更稳一点。`,
        '白天可能还好，但早晚落差会出来，这时候加一层会更从容。',
        '今天不是纯热天，外套更多是为了把温差和风感一起兜住。',
      ]),
    )
  } else if (weather.feelsLike >= 28) {
    reasons.push(
      pickVariant(seed, [
        '今天天气偏热，所以这套优先用了更轻薄、更透气的单品，没有再硬加外套。',
        '这种气温下再往上叠就容易闷，所以我先把清爽感放在前面。',
        '今天重点不是层次，而是穿得轻一点、透一点、行动更舒服。',
      ]),
    )
  } else {
    reasons.push(
      pickVariant(seed, [
        '今天温度比较舒服，这套厚薄刚好，整天穿着都不会太累。',
        '这种天气不用太纠结，厚薄走中间值反而最稳。',
        '今天不算特别热也不算冷，这套的分寸感会比较舒服。',
      ]),
    )
  }

  const styleLabel = style === 'commute' ? '通勤' : style === 'casual' ? '休闲' : '精致'
  if (preferences.preferredStyles.includes(style)) {
    reasons.push(
      pickVariant(seed + '-style', [
        `你最近本来就更偏爱${styleLabel}风，所以这套上身大概率会更顺眼。`,
        `这套的气质和你最近常选的${styleLabel}路线很接近，不容易穿得别扭。`,
        `你最近的喜好本来就偏${styleLabel}，所以这套和你的穿衣习惯是对得上的。`,
      ]),
    )
  } else {
    reasons.push(buildLookSummary(items, weather, scene, style))
  }

  if (weather.rainProbability >= 50) {
    reasons.push(
      pickVariant(seed + '-rain', [
        '这次已经尽量避开不耐雨的鞋和下装，遇到下雨会省心一点。',
        '今天有下雨概率，所以鞋和下装这边优先考虑了更省心的选择。',
        '这套已经尽量把“碰到下雨会麻烦”的单品往后放了。',
      ]),
    )
  }

  if (items.some((item) => item.category === 'accessory')) {
    reasons.push(
      pickVariant(seed + '-accessory', [
        '顺手加了一个小配饰，整套看起来会完整一点。',
        '这次的小配饰不是为了抢眼，只是让整套更像认真搭过的样子。',
        '加一个小配饰后，整体会比纯基础款更有完成度。',
      ]),
    )
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
