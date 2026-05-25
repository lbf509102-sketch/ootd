import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const dataFile = path.join(dataDir, 'app-data.json')

export const defaultUserData = {
  selectedCity: '嘉兴',
  preferences: {
    preferredStyles: ['commute', 'refined'],
    avoidCategories: [],
    avoidColors: [],
    comfortPriority: 'versatile_first',
    defaultScene: 'commute',
    acceptsLayering: true,
    avoidRepeatLooks: true,
  },
  wardrobe: [],
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
  if (store?.users && store?.otpCodes && store?.sessions) {
    return store
  }

  return {
    users: {
      '13800138000': {
        phone: '13800138000',
        nickname: '默认用户',
        data: {
          selectedCity: store?.selectedCity ?? defaultUserData.selectedCity,
          preferences: store?.preferences ?? structuredClone(defaultUserData.preferences),
          wardrobe: store?.wardrobe ?? structuredClone(defaultUserData.wardrobe),
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
