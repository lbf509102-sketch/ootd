import type { RecommendationLook, ReplaceCategory, Scene, WeatherProfile } from './types'

export type SavedSection = 'history' | 'favorite'

export type FeedbackCopyKind =
  | 'fill_current_look'
  | 'clear_tryon'
  | 'avatar_saved'
  | 'tryon_photo_saved'
  | 'mock_ready'
  | 'look_tryon_ready'
  | 'outfit_ready'
  | 'refresh_look'
  | 'replace_look'
  | 'edit_draft_applied'
  | 'batch_next_saved'
  | 'wardrobe_saved'
  | 'saved_restore_history'
  | 'saved_restore_favorite'
  | 'saved_quick_open'
  | 'quick_edit_hint'

const feedbackVariants: Record<FeedbackCopyKind, string[]> = {
  fill_current_look: [
    '已经把首页这套带过来了，你可以接着改每个部位。',
    '这套我已经替你填进来了，想调哪里直接动就行。',
    '首页那套已经搬到这里了，接下来就按你的想法慢慢改。',
  ],
  clear_tryon: [
    '这套已经清空了，现在可以重新慢慢搭。',
    '我先帮你清回空白状态了，接下来从哪一件开始都行。',
    '当前搭配已经撤掉了，现在可以从头再配一套。',
  ],
  avatar_saved: [
    '身材档案已经记好了，后面的推荐会更贴近你。',
    '这份档案已经生效，之后推荐会更像按你本人来想。',
    '我已经把这份身材信息记住了，后面会更贴身一点。',
  ],
  tryon_photo_saved: [
    '参考照已经准备好了，后面看效果图会顺很多。',
    '试穿参考照已经放好了，之后生成效果图会更方便。',
    '这张参考照已经就位，接下来出图会更顺手。',
  ],
  mock_ready: [
    '预览图已经出来了，可以直接看效果。',
    '这张效果图已经生成好了，先看一眼顺不顺眼。',
    '预览已经跑完了，现在可以继续对比。',
  ],
  look_tryon_ready: [
    '这套的效果图已经生成好了。',
    '这套现在已经有结果了，你可以直接看。',
    '这版效果图已经出来了，先看看喜不喜欢。',
  ],
  outfit_ready: [
    '整套效果图已经生成好了。',
    '完整搭配图已经出来了，现在可以直接看整体感觉。',
    '这版整套效果已经跑完了，先看整体顺不顺眼。',
  ],
  refresh_look: [
    '已经换成同天气、同场景下的另一套了。',
    '我给你切了一套新的备选，你看看这个会不会更顺眼。',
    '已经换了一版新的，现在可以直接和刚才那套对比。',
  ],
  replace_look: [
    '已经换成这一版了，整体会更顺一点。',
    '这件我已经替你换好了，整套看着会更协调。',
    '这一版已经切上来了，整体比刚才更顺。',
  ],
  edit_draft_applied: [
    '换图后的建议标签已经套用了，后面的推荐会更快变准。',
    '这套新标签我已经帮你带上了，系统后面会更懂这件衣服。',
    '换图后的标签已经生效，这件衣服后面会更容易被放到合适的位置。',
  ],
  batch_next_saved: [
    '这件已经收进衣橱了，我顺手帮你切到了下一张。',
    '这一件已经保存好了，下面这张你接着确认就行。',
    '这件衣服已经加入衣橱，下一张也已经替你准备好了。',
  ],
  wardrobe_saved: [
    '这件已经进衣橱了，后面的推荐会把它算进去。',
    '我已经帮你收好了，这件衣服接下来会出现在推荐里。',
    '新衣物已经加入衣橱，现在会参与今天的推荐。',
  ],
  saved_restore_history: [
    '这套已经调回首页了，可以直接再看。',
    '我已经把这套带回首页了，照着它继续看就行。',
    '这套已经重新调出来了，今天直接参考它也可以。',
  ],
  saved_restore_favorite: [
    '收藏这套已经回到首页了，接着用就行。',
    '我已经把这套喜欢的搭配调出来了，继续看就好。',
    '这套收藏已经带回首页了，想继续用的话直接往下看。',
  ],
  saved_quick_open: [
    '这套已经带回首页了，可以直接当今天的参考。',
    '我已经把这套顶回首页了，照着它看会更快。',
    '这套现在已经回到首页了，直接继续用就行。',
  ],
  quick_edit_hint: [
    '这张图已经够用了，想更细一点的话再往下改标签就行。',
    '先这样收也没问题，想继续细调的话直接改下面那些标签。',
    '图片这一步已经差不多了，下面主要看你要不要再修细一点。',
  ],
}

export function pickToneVariant(seed: string, variants: string[]) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) >>> 0
  }
  return variants[hash % variants.length] ?? variants[0] ?? ''
}

export function buildFeedbackCopy(kind: FeedbackCopyKind, seed: string) {
  return pickToneVariant(seed, feedbackVariants[kind])
}

export function buildForecastTipCopy(weather: WeatherProfile, dayLabel: string, seed: string) {
  if (weather.rainProbability >= 55) {
    return pickToneVariant(seed, [
      `${dayLabel}可能会下雨，鞋子和下装尽量先往省心那边选。`,
      `${dayLabel}雨意有点明显，别先挑太娇气的鞋和裤脚。`,
      `${dayLabel}看着有下雨概率，出门前尽量避开太难打理的单品。`,
    ])
  }

  if (weather.feelsLike >= 29) {
    return pickToneVariant(seed, [
      `${dayLabel}会有点热，穿轻一点会更舒服。`,
      `${dayLabel}热感会比较明显，越轻薄越不容易后悔。`,
      `${dayLabel}温度已经起来了，别穿太满，留点透气空间更舒服。`,
    ])
  }

  if (weather.tempGap >= 8 || weather.windLevel === 'high') {
    return pickToneVariant(seed, [
      `${dayLabel}温差有点大，顺手带件外套会更安心。`,
      `${dayLabel}白天和早晚会像两种天气，备一件外套更稳。`,
      `${dayLabel}风和温差都不算小，外套不一定穿上，但带着会更踏实。`,
    ])
  }

  return pickToneVariant(seed, [
    `${dayLabel}温度还算稳定，挑一套省心的就行。`,
    `${dayLabel}天气比较平和，按你最顺手的那套来就行。`,
    `${dayLabel}今天不用太纠结厚薄，选一套你穿着最舒服的就够了。`,
  ])
}

export function buildHomeSummaryHighlightCopy(look: RecommendationLook, weather: WeatherProfile, scene: Scene) {
  const hasOuterwear = look.items.some((entry) => entry.item.category === 'outerwear')
  const hasDress = look.items.some((entry) => entry.item.category === 'dress')
  const seed = `home-highlight-${look.id}-${weather.feelsLike}-${scene}-${hasOuterwear ? 'coat' : 'no-coat'}-${hasDress ? 'dress' : 'separates'}`

  if (look.backupOuterwear) {
    return pickToneVariant(seed, [
      '主穿搭先保持清爽，旁边那件外套更多是给早晚温差留余地。',
      '白天照这套穿就够了，边上那件外套主要拿来应对早晚和风感。',
      '这套的重点是轻松出门，备用外套只是让你晚上不至于突然觉得冷。',
    ])
  }

  if (hasOuterwear && weather.feelsLike >= 24) {
    return pickToneVariant(seed, [
      '外套这次不是主角，更多是顺手压一层，把风和温差一起照顾到。',
      '整体还是清爽路线，只是把外套当成一层轻薄补充。',
      '这套没有刻意堆层次，外套只是让气温切换时更从容。',
    ])
  }

  if (weather.feelsLike >= 28) {
    return pickToneVariant(seed, [
      '今天最重要的是穿得轻一点，不闷、不累、动起来更舒服。',
      '这种温度下，清爽感比层次感更重要。',
      '这套的重点就是轻、透、没有负担，适合高温天直接上身。',
    ])
  }

  if (hasDress) {
    return pickToneVariant(seed, [
      '裙装已经把氛围感撑起来了，其他单品只要别抢戏就够好看。',
      '这套的重点在裙装本身，其他位置尽量保持利落会更顺眼。',
      '裙装已经足够有存在感，所以整套特意收得更干净一点。',
    ])
  }

  return pickToneVariant(seed, [
    '这套的优点是完整度高，穿上基本不用再想太多。',
    '主线已经很清楚了，整体看着顺，细节也不容易出错。',
    '这套属于稳定发挥型，穿出门大概率会让你省心。',
  ])
}

export function buildEmptyReplacementCopy(category: ReplaceCategory | null) {
  return pickToneVariant(`replace-empty-${category ?? 'none'}`, [
    '这个位置暂时没有更合适的替换项了。',
    '这一格我暂时没找到更顺的替换方案。',
    '当前这个位置已经比较稳了，暂时没有更好的候选。',
  ])
}

export function buildSavedSectionDescriptionCopy(section: SavedSection) {
  return section === 'history'
    ? pickToneVariant(`saved-section-${section}`, [
        '穿过并确认过的搭配会留在这里，方便你之后快速回穿。',
        '最近真正穿出去过的搭配都会放在这里，忙的时候回拿会很快。',
        '这些都是你已经穿过的结果，后面想偷懒时可以直接调回来。',
      ])
    : pickToneVariant(`saved-section-${section}`, [
        '真正顺手的搭配先收藏，忙的时候可以直接调出来。',
        '看着舒服、以后还想再穿的搭配，都可以先留在这里。',
        '这里放的都是你想长期回看的搭配，赶时间时会特别省心。',
      ])
}

export function buildDecisionPulseCopy(score: number, seed: string) {
  if (score >= 90) return pickToneVariant(seed, ['今天穿它就行', '这一套就够稳', '直接选它也行'])
  if (score >= 82) return pickToneVariant(seed, ['已经比较稳了', '这套挺顺的', '这版已经能打'])
  return pickToneVariant(seed, ['还能再调一下', '再顺一顺会更好', '还有一点优化空间'])
}

export function buildPrimaryDecisionCopy(score: number, seed: string) {
  if (score >= 90) {
    return pickToneVariant(seed, [
      '这套今天直接穿，基本不会出错。',
      '今天如果想省心，直接穿这一套就够了。',
      '这套已经很完整了，照着穿出去基本就稳了。',
    ])
  }

  if (score >= 82) {
    return pickToneVariant(seed, [
      '这套已经挺合适了，想省事就选它。',
      '这版方向已经对了，不想折腾的话直接用也没问题。',
      '这套顺眼度已经够高了，忙的时候拿它最省心。',
    ])
  }

  return pickToneVariant(seed, [
    '这套方向是对的，再微调一件会更顺。',
    '整体底子已经有了，再调一个位置就会更舒服。',
    '这套不算差，只是还差一点点精修感。',
  ])
}
