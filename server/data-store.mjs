import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const dataFile = path.join(dataDir, 'app-data.json')

export const defaultUserData = {
  selectedCity: '上海',
  preferences: {
    preferredStyles: ['commute', 'refined'],
    avoidCategories: [],
    avoidColors: [],
    comfortPriority: 'versatile_first',
    defaultScene: 'commute',
    acceptsLayering: true,
    avoidRepeatLooks: true,
  },
  wardrobe: [
    {
      id: 'item-1',
      name: '奶油白衬衫',
      category: 'top',
      colorGroup: 'black_white_gray',
      thickness: 'light',
      style: 'commute',
      status: 'ready',
      seasonFit: 'spring_autumn',
      fitType: 'regular',
      preferenceScore: 82,
      wearCount: 4,
      lastWornAt: '2026-05-10',
      isDisliked: false,
    },
    {
      id: 'item-2',
      name: '烟灰针织短袖',
      category: 'top',
      colorGroup: 'black_white_gray',
      thickness: 'regular',
      style: 'commute',
      status: 'ready',
      seasonFit: 'all_season',
      fitType: 'slim',
      preferenceScore: 88,
      wearCount: 7,
      lastWornAt: '2026-05-12',
      isDisliked: false,
    },
    {
      id: 'item-3',
      name: '浅蓝牛仔衬衫',
      category: 'top',
      colorGroup: 'denim',
      thickness: 'regular',
      style: 'casual',
      status: 'ready',
      seasonFit: 'spring_autumn',
      fitType: 'relaxed',
      preferenceScore: 70,
      wearCount: 3,
      lastWornAt: '2026-05-08',
      isDisliked: false,
    },
    {
      id: 'item-4',
      name: '雾蓝西装外套',
      category: 'outerwear',
      colorGroup: 'blue',
      thickness: 'regular',
      style: 'commute',
      status: 'ready',
      seasonFit: 'spring_autumn',
      fitType: 'regular',
      preferenceScore: 86,
      wearCount: 5,
      lastWornAt: '2026-05-09',
      isDisliked: false,
    },
    {
      id: 'item-5',
      name: '米杏轻薄开衫',
      category: 'outerwear',
      colorGroup: 'khaki_brown',
      thickness: 'light',
      style: 'refined',
      status: 'ready',
      seasonFit: 'spring_autumn',
      fitType: 'regular',
      preferenceScore: 77,
      wearCount: 6,
      lastWornAt: '2026-05-06',
      isDisliked: false,
    },
    {
      id: 'item-6',
      name: '炭黑直筒西裤',
      category: 'bottom',
      colorGroup: 'black_white_gray',
      thickness: 'regular',
      style: 'commute',
      status: 'ready',
      seasonFit: 'all_season',
      fitType: 'regular',
      preferenceScore: 91,
      wearCount: 8,
      lastWornAt: '2026-05-11',
      isDisliked: false,
    },
    {
      id: 'item-7',
      name: '燕麦A字半裙',
      category: 'bottom',
      colorGroup: 'khaki_brown',
      thickness: 'light',
      style: 'refined',
      status: 'ready',
      seasonFit: 'summer',
      fitType: 'regular',
      preferenceScore: 80,
      wearCount: 2,
      lastWornAt: '2026-05-07',
      isDisliked: false,
    },
    {
      id: 'item-8',
      name: '深蓝锥形牛仔裤',
      category: 'bottom',
      colorGroup: 'denim',
      thickness: 'regular',
      style: 'casual',
      status: 'ready',
      seasonFit: 'all_season',
      fitType: 'regular',
      preferenceScore: 74,
      wearCount: 5,
      lastWornAt: '2026-05-13',
      isDisliked: false,
    },
    {
      id: 'item-9',
      name: '奶油白连衣裙',
      category: 'dress',
      colorGroup: 'black_white_gray',
      thickness: 'light',
      style: 'refined',
      status: 'ready',
      seasonFit: 'summer',
      fitType: 'regular',
      preferenceScore: 75,
      wearCount: 2,
      lastWornAt: '2026-05-04',
      isDisliked: false,
    },
    {
      id: 'item-10',
      name: '黑色乐福鞋',
      category: 'shoes',
      colorGroup: 'black_white_gray',
      thickness: 'regular',
      style: 'commute',
      status: 'ready',
      seasonFit: 'all_season',
      fitType: 'regular',
      preferenceScore: 90,
      wearCount: 10,
      lastWornAt: '2026-05-12',
      isDisliked: false,
    },
    {
      id: 'item-11',
      name: '白色简约板鞋',
      category: 'shoes',
      colorGroup: 'black_white_gray',
      thickness: 'light',
      style: 'casual',
      status: 'ready',
      seasonFit: 'all_season',
      fitType: 'regular',
      preferenceScore: 76,
      wearCount: 9,
      lastWornAt: '2026-05-13',
      isDisliked: false,
    },
    {
      id: 'item-12',
      name: '浅杏低跟单鞋',
      category: 'shoes',
      colorGroup: 'khaki_brown',
      thickness: 'light',
      style: 'refined',
      status: 'ready',
      seasonFit: 'spring_autumn',
      fitType: 'regular',
      preferenceScore: 84,
      wearCount: 4,
      lastWornAt: '2026-05-09',
      isDisliked: false,
    },
  ],
}

export const defaultData = {
  users: {
    '13800138000': {
      phone: '13800138000',
      nickname: '默认用户',
      data: structuredClone(defaultUserData),
    },
  },
  otpCodes: {},
  sessions: {},
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true })
  try {
    await readFile(dataFile, 'utf8')
  } catch {
    await writeFile(dataFile, JSON.stringify(defaultData, null, 2), 'utf8')
  }
}

function normalizeStoreShape(store) {
  if (store.users && store.otpCodes && store.sessions) {
    return store
  }

  return {
    users: {
      '13800138000': {
        phone: '13800138000',
        nickname: '默认用户',
        data: {
          selectedCity: store.selectedCity ?? defaultUserData.selectedCity,
          preferences: store.preferences ?? structuredClone(defaultUserData.preferences),
          wardrobe: store.wardrobe ?? structuredClone(defaultUserData.wardrobe),
        },
      },
    },
    otpCodes: {},
    sessions: {},
  }
}

export async function readStore() {
  await ensureStore()
  const raw = await readFile(dataFile, 'utf8')
  const parsed = JSON.parse(raw)
  const normalized = normalizeStoreShape(parsed)
  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    await writeFile(dataFile, JSON.stringify(normalized, null, 2), 'utf8')
  }
  return normalized
}

export async function writeStore(data) {
  await ensureStore()
  await writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8')
  return data
}

export function createUserRecord(phone) {
  return {
    phone,
    nickname: `用户${phone.slice(-4)}`,
    data: structuredClone(defaultUserData),
  }
}
