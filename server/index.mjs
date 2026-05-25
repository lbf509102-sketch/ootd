import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'

try {
  process.loadEnvFile?.('.env')
} catch {
  // Ignore missing local env file in development.
}

import {
  addSavedLook,
  addTryOnSession,
  addWardrobeItem,
  createSession,
  deleteOtp,
  deleteSession,
  deleteWardrobeItem,
  getAvatarProfile,
  getOtp,
  getSession,
  getTryOnSession,
  getTryOnSessions,
  getUser,
  getUserBundle,
  getWardrobeItem,
  recordLookWear,
  removeSavedLook,
  saveOtp,
  updateSelectedCity,
  updateTryOnSession,
  updateWardrobeItem,
  updateWardrobeStatus,
  upsertAvatarProfile,
  upsertPreferences,
  upsertUser,
} from './db.mjs'
import { classifyGarmentImage, classifyGarmentImages } from './garment-ai-service.mjs'
import { ensureUploadDir, processAndSaveImage, removeUploadedFile } from './image-service.mjs'
import { sendVerificationCode } from './sms-provider.mjs'
import { createMockTryOnPreview } from './tryon-mock-service.mjs'
import { generateTryOnPreview, getTryOnCapabilities } from './tryon-provider-service.mjs'
import { addShoesToTryOnResult } from './tryon-shoe-compose-service.mjs'
import { validateLookTryOnResult } from './tryon-validation-service.mjs'
import { cityOptions, fetchCityWeather } from './weather-service.mjs'
import { generateOutfitPreview } from './outfit-generation-provider-service.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const uploadsDir = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(__dirname, 'uploads')
const port = Number(process.env.PORT ?? 3001)
const corsOrigin = process.env.CORS_ORIGIN?.trim()

ensureUploadDir(uploadsDir)

const app = express()

app.use(
  cors(
    corsOrigin
      ? {
          origin: corsOrigin.split(',').map((entry) => entry.trim()),
        }
      : undefined,
  ),
)
app.use(express.json({ limit: process.env.JSON_LIMIT ?? '15mb' }))
app.use('/uploads', express.static(uploadsDir))

function getToken(req) {
  const header = req.headers.authorization
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7)
  }
  return ''
}

function getAuthedUser(req) {
  const token = getToken(req)
  const session = getSession(token)
  if (!session) {
    return { user: null, token: '' }
  }

  return {
    user: getUser(session.phone),
    token,
  }
}

function requireUser(req, res) {
  const { user, token } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return null
  }
  return { user, token }
}

function buildDefaultBundle(phone, nickname) {
  upsertUser(phone, nickname, '\u5609\u5174')
  upsertPreferences(phone, {
    preferredStyles: ['commute', 'refined'],
    avoidCategories: [],
    avoidColors: [],
    comfortPriority: 'versatile_first',
    defaultScene: 'commute',
    acceptsLayering: true,
    avoidRepeatLooks: true,
  })
  upsertAvatarProfile(phone, {
    heightCm: 165,
    weightKg: 55,
    genderPresentation: 'feminine',
    bodyShape: 'balanced',
    shoulderType: 'regular',
    waistType: 'regular',
    hipType: 'regular',
    legLengthType: 'regular',
    tryOnPhotoUrl: null,
  })
  return getUserBundle(phone)
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function sanitizeString(value, fallback = '') {
  if (typeof value !== 'string') return fallback
  return value.trim()
}

function sanitizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

function sanitizeStringArray(value, allowed = []) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((entry) => sanitizeString(entry)).filter((entry) => entry && (allowed.length === 0 || allowed.includes(entry))))]
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length)
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

function buildLookTryOnKey(itemIds) {
  const ordered = [...new Set(itemIds.map((entry) => String(entry ?? '').trim()).filter(Boolean))].sort()
  return ordered.join('__')
}

function buildOutfitGenerationKey(itemIds) {
  const ordered = [...new Set(itemIds.map((entry) => String(entry ?? '').trim()).filter(Boolean))].sort()
  return ordered.length ? `outfit:${ordered.join('__')}` : ''
}

function getTryOnGarmentImageUrl(item) {
  return item?.sourceImageUrl || item?.imageUrl || item?.displayImageUrl || ''
}

function getLookTryOnItems(wardrobe, garmentItemIds) {
  const itemMap = new Map(wardrobe.map((item) => [item.id, item]))
  return garmentItemIds.map((id) => itemMap.get(id)).filter(Boolean)
}

function buildLookTryOnPlan(items) {
  const dresses = items.filter((item) => item.category === 'dress')
  const tops = items.filter((item) => item.category === 'top')
  const outerwear = items.filter((item) => item.category === 'outerwear')
  const bottoms = items.filter((item) => item.category === 'bottom')
  const shoes = items.find((item) => item.category === 'shoes') ?? null

  return {
    dress: dresses[0] ?? null,
    top: tops[0] ?? outerwear[0] ?? null,
    bottom: bottoms[0] ?? null,
    outerwear: outerwear[0] ?? null,
    shoes,
  }
}

function normalizeAvatarProfile(input) {
  return {
    heightCm: clampInteger(input?.heightCm, 130, 220, 165),
    weightKg: clampInteger(input?.weightKg, 30, 180, 55),
    genderPresentation: ['feminine', 'masculine', 'neutral'].includes(input?.genderPresentation)
      ? input.genderPresentation
      : 'feminine',
    bodyShape: ['balanced', 'pear', 'apple', 'rectangle', 'inverted_triangle', 'hourglass'].includes(input?.bodyShape)
      ? input.bodyShape
      : 'balanced',
    shoulderType: ['narrow', 'regular', 'broad'].includes(input?.shoulderType) ? input.shoulderType : 'regular',
    waistType: ['defined', 'regular', 'soft'].includes(input?.waistType) ? input.waistType : 'regular',
    hipType: ['narrow', 'regular', 'curvy'].includes(input?.hipType) ? input.hipType : 'regular',
    legLengthType: ['shorter', 'regular', 'longer'].includes(input?.legLengthType) ? input.legLengthType : 'regular',
    tryOnPhotoUrl:
      typeof input?.tryOnPhotoUrl === 'string' && input.tryOnPhotoUrl.trim() ? input.tryOnPhotoUrl.trim() : null,
  }
}

const allowedCategories = ['top', 'bottom', 'outerwear', 'shoes', 'dress', 'accessory']
const allowedColors = ['black_white_gray', 'blue', 'khaki_brown', 'denim', 'accent']
const allowedThickness = ['light', 'regular', 'warm']
const allowedStyles = ['commute', 'casual', 'refined']
const allowedStatuses = ['ready', 'dirty']
const allowedSeasons = ['summer', 'spring_autumn', 'winter', 'all_season']
const allowedFitTypes = ['slim', 'regular', 'relaxed']
const allowedGarmentLengths = ['short', 'regular', 'long', 'midi', 'maxi']
const allowedSleeveLengths = ['sleeveless', 'short', 'three_quarter', 'long', 'na']
const allowedSilhouettes = ['fitted', 'straight', 'relaxed', 'a_line']
const allowedScenes = ['commute', 'daily', 'date', 'formal']
const allowedComfortPriorities = ['warmth_first', 'lightness_first', 'slimming_first', 'versatile_first']

function sanitizeImageUrl(value) {
  const normalized = sanitizeString(value)
  if (!normalized) return null
  if (normalized.startsWith('/uploads/') || normalized.startsWith('data:image/')) {
    return normalized
  }
  return null
}

function inferVisualMeta(category, fitType) {
  const silhouette =
    fitType === 'slim' ? 'fitted' : fitType === 'relaxed' ? 'relaxed' : category === 'dress' ? 'a_line' : 'straight'

  if (category === 'top') {
    return { garmentLength: 'regular', sleeveLength: 'short', silhouette }
  }

  if (category === 'outerwear') {
    return { garmentLength: 'long', sleeveLength: 'long', silhouette }
  }

  if (category === 'dress') {
    return { garmentLength: 'midi', sleeveLength: 'short', silhouette: fitType === 'slim' ? 'fitted' : 'a_line' }
  }

  if (category === 'bottom') {
    return { garmentLength: 'regular', sleeveLength: 'na', silhouette }
  }

  return { garmentLength: 'short', sleeveLength: 'na', silhouette: 'straight' }
}

function normalizePreferencesInput(input) {
  return {
    preferredStyles: sanitizeStringArray(input?.preferredStyles, allowedStyles).slice(0, 3),
    avoidCategories: sanitizeStringArray(input?.avoidCategories, allowedCategories),
    avoidColors: sanitizeStringArray(input?.avoidColors, allowedColors),
    comfortPriority: sanitizeEnum(input?.comfortPriority, allowedComfortPriorities, 'versatile_first'),
    defaultScene: sanitizeEnum(input?.defaultScene, allowedScenes, 'commute'),
    acceptsLayering: Boolean(input?.acceptsLayering),
    avoidRepeatLooks: input?.avoidRepeatLooks !== false,
  }
}

function normalizeWardrobeItemInput(input, { existingId = '', fallbackStatus = 'ready' } = {}) {
  const category = sanitizeEnum(input?.category, allowedCategories, 'top')
  const fitType = sanitizeEnum(input?.fitType, allowedFitTypes, 'regular')
  const visualMeta = inferVisualMeta(category, fitType)
  const imageUrl = sanitizeImageUrl(input?.imageUrl)
  const displayImageUrl = sanitizeImageUrl(input?.displayImageUrl) ?? imageUrl
  const sourceImageUrl = sanitizeImageUrl(input?.sourceImageUrl) ?? displayImageUrl ?? imageUrl

  return {
    id: sanitizeString(input?.id) || existingId || `item-${crypto.randomUUID()}`,
    name: sanitizeString(input?.name) || '未命名单品',
    category,
    colorGroup: sanitizeEnum(input?.colorGroup, allowedColors, 'black_white_gray'),
    thickness: sanitizeEnum(input?.thickness, allowedThickness, 'regular'),
    style: sanitizeEnum(input?.style, allowedStyles, 'commute'),
    status: sanitizeEnum(input?.status, allowedStatuses, fallbackStatus),
    seasonFit: sanitizeEnum(input?.seasonFit, allowedSeasons, 'spring_autumn'),
    fitType,
    garmentLength: sanitizeEnum(input?.garmentLength, allowedGarmentLengths, visualMeta.garmentLength),
    sleeveLength: sanitizeEnum(input?.sleeveLength, allowedSleeveLengths, visualMeta.sleeveLength),
    silhouette: sanitizeEnum(input?.silhouette, allowedSilhouettes, visualMeta.silhouette),
    preferenceScore: clampInteger(input?.preferenceScore, 0, 100, 75),
    wearCount: clampInteger(input?.wearCount, 0, 9999, 0),
    createdAt: sanitizeString(input?.createdAt) || new Date().toISOString(),
    lastWornAt: sanitizeString(input?.lastWornAt) || undefined,
    isDisliked: Boolean(input?.isDisliked),
    imageUrl: displayImageUrl,
    displayImageUrl,
    sourceImageUrl,
  }
}

function assessExtractionRisk({ draft, subjectStats }) {
  const componentCount = subjectStats?.componentCount ?? 0
  const method = subjectStats?.method ?? ''
  const extracted = Boolean(subjectStats?.extracted)
  const pipeline = subjectStats?.pipeline ?? ''
  const failureMessage = String(subjectStats?.failureMessage ?? '').trim()
  const category = draft?.category ?? ''
  const confidence = Number(draft?.confidence ?? 0)

  if (pipeline === 'cloud_required') {
    return {
      riskLevel: 'high',
      riskMessage: failureMessage || '当前云端分割不可用，这次先保留了原图。',
    }
  }

  if (!extracted) {
    return {
      riskLevel: 'high',
      riskMessage: '这张图和背景太接近，当前不适合自动提取，建议换更干净的单品图。',
    }
  }

  if (method === 'ai_studio_fallback') {
    return {
      riskLevel: 'high',
      riskMessage: '这张图背景和主体干扰较重，当前先保留了整理图。建议换纯背景或单品近景图。',
    }
  }

  if (category === 'shoes' && componentCount > 2) {
    return {
      riskLevel: 'high',
      riskMessage: '这张鞋图结构太碎，容易改坏鞋带和鞋舌，建议换单鞋近景图或纯背景图。',
    }
  }

  if (componentCount > 1 || confidence < 0.75) {
    return {
      riskLevel: 'medium',
      riskMessage: '这张图存在多主体或识别不够稳，建议你确认品类，必要时换更干净的单品图。',
    }
  }

  return {
    riskLevel: 'low',
    riskMessage: '',
  }
}

app.post('/api/auth/request-code', async (req, res) => {
  const phone = String(req.body.phone ?? '').trim()
  if (!/^\d{11}$/.test(phone)) {
    res.status(400).json({ message: '请输入 11 位手机号' })
    return
  }

  const code = process.env.DEV_LOGIN_CODE ?? '123456'
  saveOtp(phone, code, Date.now() + 5 * 60 * 1000)
  const payload = await sendVerificationCode(phone, code)
  res.json(payload)
})

app.post('/api/auth/verify-code', async (req, res) => {
  const phone = String(req.body.phone ?? '').trim()
  const code = String(req.body.code ?? '').trim()
  const otp = getOtp(phone)

  if (!otp || otp.code !== code || otp.expiresAt < Date.now()) {
    res.status(401).json({ message: '验证码不正确或已过期' })
    return
  }

  if (!getUser(phone)) {
    buildDefaultBundle(phone, `用户${phone.slice(-4)}`)
  }

  const token = `session-${crypto.randomUUID()}`
  createSession(token, phone, Date.now())
  deleteOtp(phone)

  const user = getUser(phone)
  res.json({
    token,
    user: {
      phone,
      nickname: user?.nickname ?? `用户${phone.slice(-4)}`,
    },
  })
})

app.get('/api/auth/session', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  res.json({
    token: auth.token,
    user: {
      phone: auth.user.phone,
      nickname: auth.user.nickname,
    },
  })
})

app.post('/api/auth/logout', async (req, res) => {
  const token = getToken(req)
  if (token) deleteSession(token)
  res.json({ ok: true })
})

app.get('/api/bootstrap', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const bundle = getUserBundle(auth.user.phone)
  res.json({
    selectedCity: bundle.user.selectedCity,
    preferences: bundle.preferences,
    avatarProfile: bundle.avatarProfile,
    wardrobe: bundle.wardrobe,
    history: bundle.history,
    favorites: bundle.favorites,
    tryOnSessions: bundle.tryOnSessions,
    tryOnCapabilities: getTryOnCapabilities(),
    cities: cityOptions.map((entry) => ({ city: entry.city })),
    user: {
      phone: bundle.user.phone,
      nickname: bundle.user.nickname,
    },
  })
})

app.get('/api/avatar-profile', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return
  res.json(getAvatarProfile(auth.user.phone))
})

app.put('/api/avatar-profile', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const profile = normalizeAvatarProfile(req.body)
  upsertAvatarProfile(auth.user.phone, profile)
  res.json(profile)
})

app.get('/api/try-on/sessions', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return
  res.json(getTryOnSessions(auth.user.phone))
})

app.post('/api/try-on/sessions', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const garmentItemId = String(req.body.garmentItemId ?? '').trim()
  if (!garmentItemId) {
    res.status(400).json({ message: '请先选择一件想展示的单品' })
    return
  }

  const bundle = getUserBundle(auth.user.phone)
  const garmentItem = bundle?.wardrobe.find((item) => item.id === garmentItemId)
  if (!garmentItem?.imageUrl) {
    res.status(400).json({ message: '这件衣物还没有可用图片，请先补一张单品图' })
    return
  }

  if (!bundle?.avatarProfile?.tryOnPhotoUrl) {
    res.status(400).json({ message: '请先上传本人参考照，再生成展示图' })
    return
  }

  const session = addTryOnSession(auth.user.phone, {
    garmentItemId,
    personImageUrl: bundle.avatarProfile.tryOnPhotoUrl,
    garmentImageUrl: garmentItem.imageUrl,
    provider: null,
    status: 'draft_ready',
    note: `已为 ${garmentItem.name} 准备好展示素材，可以继续生成展示图。`,
  })

  res.status(201).json(session)
})

app.post('/api/try-on/sessions/:id/mock-preview', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const existing = getTryOnSession(auth.user.phone, req.params.id)
  if (!existing) {
    res.status(404).json({ message: '这条展示任务不存在' })
    return
  }

  const garmentItem = getWardrobeItem(auth.user.phone, existing.garmentItemId)
  if (!garmentItem?.imageUrl) {
    res.status(400).json({ message: '这件衣物缺少可用图片，暂时没法生成展示图' })
    return
  }

  try {
    const resultImageUrl = await createMockTryOnPreview({
      uploadsDir,
      personImageUrl: existing.personImageUrl,
      garmentImageUrl: existing.garmentImageUrl,
      garmentName: garmentItem.name,
      garmentCategory: garmentItem.category,
      phone: auth.user.phone,
      sessionId: existing.id,
    })

    const updated = updateTryOnSession(auth.user.phone, existing.id, {
      resultImageUrl,
      status: 'completed',
      note: `${garmentItem.name} 的展示图已经生成好了，可以先用来演示整体方向。`,
    })

    res.json(updated)
  } catch (error) {
    const updated = updateTryOnSession(auth.user.phone, existing.id, {
      resultImageUrl: existing.resultImageUrl ?? null,
      status: 'failed',
      note: error instanceof Error ? error.message : '展示图生成失败',
    })
    res.status(500).json(updated)
  }
})

app.post('/api/try-on/sessions/:id/generate', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const existing = getTryOnSession(auth.user.phone, req.params.id)
  if (!existing) {
    res.status(404).json({ message: '这条展示任务不存在' })
    return
  }

  const garmentItem = getWardrobeItem(auth.user.phone, existing.garmentItemId)
  if (!garmentItem?.imageUrl) {
    res.status(400).json({ message: '这件衣物缺少可用图片，暂时没法生成展示图' })
    return
  }

  try {
    updateTryOnSession(auth.user.phone, existing.id, {
      resultImageUrl: existing.resultImageUrl ?? null,
      provider: existing.provider ?? null,
      status: 'processing',
      note: `正在为 ${garmentItem.name} 生成展示图，请稍等片刻。`,
    })

    const generated = await generateTryOnPreview({
      uploadsDir,
      personImageUrl: existing.personImageUrl,
      garmentImageUrl: existing.garmentImageUrl,
      garmentName: garmentItem.name,
      garmentCategory: garmentItem.category,
      phone: auth.user.phone,
      sessionId: existing.id,
    })

    const updated = updateTryOnSession(auth.user.phone, existing.id, {
      resultImageUrl: generated.resultImageUrl,
      baseResultImageUrl: generated.resultImageUrl,
      provider: generated.provider,
      status: 'completed',
      note: generated.note,
    })

    res.json(updated)
  } catch (error) {
    const updated = updateTryOnSession(auth.user.phone, existing.id, {
      resultImageUrl: existing.resultImageUrl ?? null,
      provider: existing.provider ?? null,
      status: 'failed',
      note: error instanceof Error ? error.message : '展示图生成失败',
    })
    res.status(500).json(updated)
  }
})

app.post('/api/try-on/sessions/:id/add-shoes', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const tryOnCapabilities = getTryOnCapabilities()
  if (!tryOnCapabilities.supportsShoesTryOn) {
    res.status(400).json({
      message: `当前 ${tryOnCapabilities.provider} 试穿链路还不支持 AI 鞋子试穿，请不要再走本地贴图补鞋。`,
    })
    return
  }

  const existing = getTryOnSession(auth.user.phone, req.params.id)
  if (!existing) {
    res.status(404).json({ message: '这条展示任务不存在' })
    return
  }

  if (!existing.resultImageUrl || existing.status !== 'completed') {
    res.status(400).json({ message: '请先生成衣服主体结果，再继续补鞋子。' })
    return
  }

  const shoeItemId = String(req.body.shoeItemId ?? '').trim()
  if (!shoeItemId) {
    res.status(400).json({ message: '请先选择要补进去的鞋子。' })
    return
  }

  const shoeItem = getWardrobeItem(auth.user.phone, shoeItemId)
  if (!shoeItem?.imageUrl || shoeItem.category !== 'shoes') {
    res.status(400).json({ message: '当前鞋子素材不可用，暂时没法补鞋。' })
    return
  }

  try {
    const resultImageUrl = await addShoesToTryOnResult({
      uploadsDir,
      resultImageUrl: existing.baseResultImageUrl ?? existing.resultImageUrl,
      shoeImageUrl: shoeItem.imageUrl,
      shoeName: shoeItem.name,
      phone: auth.user.phone,
      sessionId: existing.id,
    })

    const updated = updateTryOnSession(auth.user.phone, existing.id, {
      resultImageUrl,
      baseResultImageUrl: existing.baseResultImageUrl ?? existing.resultImageUrl,
      provider: existing.provider ?? 'aliyun',
      status: 'completed',
      note: `${shoeItem.name} 已经补进这张上身结果里了。`,
    })

    res.json(updated)
  } catch (error) {
    const updated = updateTryOnSession(auth.user.phone, existing.id, {
      resultImageUrl: existing.resultImageUrl ?? null,
      baseResultImageUrl: existing.baseResultImageUrl ?? null,
      provider: existing.provider ?? null,
      status: 'failed',
      note: error instanceof Error ? error.message : '补鞋失败',
    })
    res.status(500).json(updated)
  }
})

app.post('/api/try-on/look-preview', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const garmentItemIds = Array.isArray(req.body.garmentItemIds)
    ? req.body.garmentItemIds.map((entry) => String(entry ?? '').trim()).filter(Boolean)
    : []
  const forceRegenerate = req.body.force === true

  if (garmentItemIds.length === 0) {
    res.status(400).json({ message: '请先给出当前这套要生成的单品。' })
    return
  }

  const bundle = getUserBundle(auth.user.phone)
  if (!bundle?.avatarProfile?.tryOnPhotoUrl) {
    res.status(400).json({ message: '请先上传本人参考照，再生成这套上身效果。' })
    return
  }

  const lookItems = getLookTryOnItems(bundle.wardrobe, garmentItemIds)
  const lookKey = buildLookTryOnKey(
    lookItems.filter((item) => item.category !== 'shoes' && item.category !== 'accessory').map((item) => item.id),
  )

  if (!lookKey) {
    res.status(400).json({ message: '这套当前没有可用于试穿的主单品。' })
    return
  }

  const existing = getTryOnSessions(auth.user.phone).find((entry) => entry.lookKey === lookKey && entry.status === 'completed' && entry.resultImageUrl)
  if (existing && !forceRegenerate) {
    res.json(existing)
    return
  }

  const tryOnCapabilities = getTryOnCapabilities()
  const { dress, top, bottom, outerwear, shoes } = buildLookTryOnPlan(lookItems)
  if (outerwear && !tryOnCapabilities.supportsOuterwearLayering) {
    res.status(400).json({
      message: `当前 ${tryOnCapabilities.provider} 试穿链路还不支持 AI 外套叠穿，请先去掉外套再生成。`,
    })
    return
  }
  if (shoes && !tryOnCapabilities.supportsShoesTryOn) {
    res.status(400).json({
      message: `当前 ${tryOnCapabilities.provider} 试穿链路还不支持 AI 鞋子试穿，请先去掉鞋子再生成。`,
    })
    return
  }

  const mainGarments = [dress, top, bottom].filter(Boolean)
  if (mainGarments.length === 0) {
    res.status(400).json({ message: '这套当前没有可用于试穿的衣物。' })
    return
  }

  const invalidItem = mainGarments.find((item) => !item.imageUrl)
  if (invalidItem) {
    res.status(400).json({ message: `${invalidItem.name} 还没有可用图片，请先补一张单品图。` })
    return
  }

  const primaryItem = dress ?? top ?? bottom
  const session = addTryOnSession(auth.user.phone, {
    garmentItemId: primaryItem.id,
    lookKey,
    personImageUrl: bundle.avatarProfile.tryOnPhotoUrl,
    garmentImageUrl: primaryItem.imageUrl,
    provider: null,
    status: 'processing',
    note: `正在为这套生成上身效果：${mainGarments.map((item) => item.name).join(' + ')}`,
  })

  try {
    const maxAttempts = 3
    const shouldValidateResult = mainGarments.length > 1
    let generated = null
    let validation = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const candidate = await generateTryOnPreview({
        uploadsDir,
        personImageUrl: bundle.avatarProfile.tryOnPhotoUrl,
        garmentImageUrl: dress?.imageUrl ?? top?.imageUrl ?? '',
        topGarmentImageUrl: dress ? '' : top?.imageUrl ?? '',
        bottomGarmentImageUrl: dress ? '' : bottom?.imageUrl ?? '',
        garmentName: mainGarments.map((item) => item.name).join(' + '),
        garmentCategory: dress ? 'dress' : 'look',
        phone: auth.user.phone,
        sessionId: `${session.id}-${attempt}`,
      })

      const candidateValidation = shouldValidateResult
        ? await validateLookTryOnResult({
            uploadsDir,
            resultImageUrl: candidate.resultImageUrl,
            expectedItems: mainGarments,
          }).catch(() => ({ passed: true, score: 1, issues: [], skipped: true }))
        : { passed: true, score: 1, issues: [], skipped: true }

      generated = candidate
      validation = candidateValidation

      if (candidateValidation.passed) {
        break
      }
    }

    if (!generated || !validation) {
      throw new Error('这套上身效果生成失败了。')
    }

    if (!validation.passed) {
      throw new Error(
        validation.issues?.length
          ? `这套生成结果和单品对不上：${validation.issues.join('；')}`
          : '这套生成结果和当前单品对不上，请重新尝试。',
      )
    }

    const updated = updateTryOnSession(auth.user.phone, session.id, {
      resultImageUrl: generated.resultImageUrl,
      baseResultImageUrl: generated.resultImageUrl,
      provider: generated.provider,
      status: 'completed',
      note: `${mainGarments.map((item) => item.name).join(' + ')} 已生成整套上身效果。`,
    })

    res.json(updated)
  } catch (error) {
    const updated = updateTryOnSession(auth.user.phone, session.id, {
      resultImageUrl: session.resultImageUrl ?? null,
      baseResultImageUrl: session.baseResultImageUrl ?? null,
      provider: session.provider ?? null,
      status: 'failed',
      note: error instanceof Error ? error.message : '这套上身效果生成失败了。',
    })
    res.status(500).json(updated)
  }
})

app.post('/api/outfit/generate', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const garmentItemIds = Array.isArray(req.body.garmentItemIds)
    ? req.body.garmentItemIds.map((entry) => String(entry ?? '').trim()).filter(Boolean)
    : []
  const forceRegenerate = req.body.force === true

  if (garmentItemIds.length === 0) {
    res.status(400).json({ message: '请先给出当前这套要生成效果图的单品。' })
    return
  }

  const bundle = getUserBundle(auth.user.phone)
  if (!bundle?.avatarProfile?.tryOnPhotoUrl) {
    res.status(400).json({ message: '请先上传本人参考照，再生成整套效果图。' })
    return
  }

  const lookItems = getLookTryOnItems(bundle.wardrobe, garmentItemIds).filter((item) => item.category !== 'accessory')
  const outfitKey = buildOutfitGenerationKey(lookItems.map((item) => item.id))
  if (!outfitKey) {
    res.status(400).json({ message: '这套当前没有可用于生成效果图的衣物。' })
    return
  }

  const existing = getTryOnSessions(auth.user.phone).find(
    (entry) => entry.lookKey === outfitKey && entry.status === 'completed' && entry.resultImageUrl,
  )
  if (existing && !forceRegenerate) {
    res.json(existing)
    return
  }

  const invalidItem = lookItems.find((item) => !item.imageUrl)
  if (invalidItem) {
    res.status(400).json({ message: `${invalidItem.name} 还没有可用图片，请先补一张单品图。` })
    return
  }

  const primaryItem = lookItems[0]
  const session = addTryOnSession(auth.user.phone, {
    garmentItemId: primaryItem.id,
    lookKey: outfitKey,
    personImageUrl: bundle.avatarProfile.tryOnPhotoUrl,
    garmentImageUrl: primaryItem.imageUrl,
    provider: null,
    status: 'processing',
    note: `正在为这套生成整套效果图：${lookItems.map((item) => item.name).join(' + ')}`,
  })

  try {
    const generated = await generateOutfitPreview({
      uploadsDir,
      personImageUrl: bundle.avatarProfile.tryOnPhotoUrl,
      garments: lookItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        imageUrl: getTryOnGarmentImageUrl(item),
      })),
      sceneHint: req.body.sceneHint ? String(req.body.sceneHint).trim() : '',
      phone: auth.user.phone,
    })

    const updated = updateTryOnSession(auth.user.phone, session.id, {
      resultImageUrl: generated.resultImageUrl,
      baseResultImageUrl: generated.resultImageUrl,
      provider: generated.provider,
      status: 'completed',
      note: generated.note,
    })

    res.json(updated)
  } catch (error) {
    const updated = updateTryOnSession(auth.user.phone, session.id, {
      resultImageUrl: session.resultImageUrl ?? null,
      baseResultImageUrl: session.baseResultImageUrl ?? null,
      provider: session.provider ?? null,
      status: 'failed',
      note: error instanceof Error ? error.message : '整套效果图生成失败了。',
    })
    res.status(500).json(updated)
  }
})

app.post('/api/dev/try-on/webhook-sample', async (req, res) => {
  const personImageUrl = String(req.body.personImageUrl ?? '').trim()
  const garmentImageUrl = String(req.body.garmentImageUrl ?? '').trim()
  const garmentName = String(req.body.garmentName ?? '试穿单品').trim() || '试穿单品'
  const phone = String(req.body.phone ?? 'dev-tryon').trim() || 'dev-tryon'
  const sessionId = String(req.body.sessionId ?? crypto.randomUUID()).trim() || crypto.randomUUID()

  if (!personImageUrl.startsWith('/uploads/') || !garmentImageUrl.startsWith('/uploads/')) {
    res.status(400).json({
      message: 'personImageUrl and garmentImageUrl must both be local /uploads paths.',
    })
    return
  }

  try {
    const resultImageUrl = await createMockTryOnPreview({
      uploadsDir,
      personImageUrl,
      garmentImageUrl,
      garmentName,
      garmentCategory: 'top',
      phone,
      sessionId,
    })

    res.json({
      resultImageUrl,
      note: `Sample webhook generated a preview for ${garmentName}.`,
    })
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Sample try-on webhook failed.',
    })
  }
})

app.get('/api/weather', async (req, res) => {
  const city = typeof req.query.city === 'string' ? req.query.city : '上海'
  const weather = await fetchCityWeather(city)
  res.json(weather)
})

app.post('/api/uploads/image', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const dataUrl = String(req.body.dataUrl ?? '')
  const processingMode = req.body.processingMode === 'subject' ? 'subject' : 'standard'

  try {
    const result = await processAndSaveImage({
      dataUrl,
      phone: auth.user.phone,
      uploadsDir,
      processingMode,
    })
    res.status(201).json(result)
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : '图片处理失败',
    })
  }
})

app.post('/api/uploads/garment-analyze', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const dataUrl = String(req.body.dataUrl ?? '')
  const processingMode = req.body.processingMode === 'subject' ? 'subject' : 'standard'
  if (!dataUrl.startsWith('data:image/')) {
    res.status(400).json({ message: '请上传有效图片' })
    return
  }

  try {
    const [draft, uploadResult] =
      processingMode === 'standard'
        ? await Promise.all([
            classifyGarmentImage(dataUrl).catch(() => null),
            processAndSaveImage({
              dataUrl,
              phone: auth.user.phone,
              uploadsDir,
              processingMode,
            }),
          ])
        : await (async () => {
            const analyzedDraft = await classifyGarmentImage(dataUrl).catch(() => null)
            const processedUpload = await processAndSaveImage({
              dataUrl,
              phone: auth.user.phone,
              uploadsDir,
              processingMode,
              categoryHint: analyzedDraft?.category ?? '',
            })
            return [analyzedDraft, processedUpload]
          })()

    const extractionRisk = assessExtractionRisk({
      draft,
      subjectStats: uploadResult.subjectStats,
    })

    res.status(201).json({
      imageUrl: uploadResult.imageUrl,
      sourceImageUrl: uploadResult.sourceImageUrl,
      processingMode: uploadResult.processingMode,
      draft,
      subjectStats: uploadResult.subjectStats,
      needsConfirmation:
        extractionRisk.riskLevel !== 'low' ||
        !draft ||
        draft.confidence < 0.8 ||
        (uploadResult.subjectStats?.componentCount ?? 0) > 1,
      riskLevel: extractionRisk.riskLevel,
      riskMessage: extractionRisk.riskMessage,
    })
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : '图片处理失败',
    })
  }
})

app.post('/api/uploads/garment-analyze-batch', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const items = Array.isArray(req.body.items) ? req.body.items : []
  const processingMode = req.body.processingMode === 'subject' ? 'subject' : 'standard'
  const normalizedItems = items
    .map((item, index) => ({
      index,
      fileName: typeof item?.fileName === 'string' ? item.fileName : `image-${index + 1}`,
      dataUrl: typeof item?.dataUrl === 'string' ? item.dataUrl : '',
    }))
    .filter((item) => item.dataUrl.startsWith('data:image/'))

  if (!normalizedItems.length) {
    res.status(400).json({ message: '请先上传有效图片。' })
    return
  }

  try {
    const batchConcurrency = clampInteger(process.env.BATCH_UPLOAD_CONCURRENCY, 1, 6, 3)
    const draftsPromise =
      processingMode === 'standard'
        ? classifyGarmentImages(normalizedItems.map((item) => item.dataUrl)).catch(() => normalizedItems.map(() => null))
        : Promise.resolve(normalizedItems.map(() => null))

    const uploadResultsPromise = mapWithConcurrency(normalizedItems, batchConcurrency, async (item, index) => {
        const categoryHint =
          processingMode === 'subject'
            ? (await classifyGarmentImage(item.dataUrl).catch(() => null))?.category ?? ''
            : ''

        const uploadResult = await processAndSaveImage({
          dataUrl: item.dataUrl,
          phone: auth.user.phone,
          uploadsDir,
          processingMode,
          categoryHint,
        })

        return {
          index,
          fileName: item.fileName,
          uploadResult,
        }
      })

    const [drafts, uploadResults] = await Promise.all([draftsPromise, uploadResultsPromise])

    const results = uploadResults.map(({ index, fileName, uploadResult }) => {
      const draft = drafts[index] ?? null
      const extractionRisk = assessExtractionRisk({
        draft,
        subjectStats: uploadResult.subjectStats,
      })

      return {
        index,
        fileName,
        imageUrl: uploadResult.imageUrl,
        sourceImageUrl: uploadResult.sourceImageUrl,
        processingMode: uploadResult.processingMode,
        draft,
        subjectStats: uploadResult.subjectStats,
        needsConfirmation:
          extractionRisk.riskLevel !== 'low' ||
          !draft ||
          draft.confidence < 0.8 ||
          (uploadResult.subjectStats?.componentCount ?? 0) > 1,
        riskLevel: extractionRisk.riskLevel,
        riskMessage: extractionRisk.riskMessage,
      }
    })

    res.status(201).json({ results })
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : '图片处理失败',
    })
  }
})

app.post('/api/vision/garment-draft', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const dataUrl = String(req.body.dataUrl ?? '')
  if (!dataUrl.startsWith('data:image/')) {
    res.status(400).json({ message: '请上传有效图片' })
    return
  }

  try {
    const result = await classifyGarmentImage(dataUrl)
    res.json({ draft: result })
  } catch (error) {
    res.status(502).json({
      message: error instanceof Error ? error.message : '识别服务暂时不可用',
    })
  }
})

app.put('/api/selected-city', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  updateSelectedCity(auth.user.phone, req.body.city ?? auth.user.selectedCity)
  res.json({ selectedCity: req.body.city ?? auth.user.selectedCity })
})

app.put('/api/preferences', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const preferences = normalizePreferencesInput(req.body)
  upsertPreferences(auth.user.phone, preferences)
  res.json(preferences)
})

app.post('/api/wardrobe/items', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const item = normalizeWardrobeItemInput(req.body, { fallbackStatus: 'ready' })
  addWardrobeItem(auth.user.phone, item)
  res.status(201).json(getWardrobeItem(auth.user.phone, item.id) ?? item)
})

app.put('/api/wardrobe/items/:id', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const existing = getWardrobeItem(auth.user.phone, req.params.id)
  if (!existing) {
    res.status(404).json({ message: '衣物不存在' })
    return
  }

  const item = normalizeWardrobeItemInput(
    {
      ...existing,
      ...req.body,
      id: req.params.id,
      status: req.body.status ?? existing.status,
      preferenceScore: req.body.preferenceScore ?? existing.preferenceScore,
      wearCount: req.body.wearCount ?? existing.wearCount,
      lastWornAt: req.body.lastWornAt ?? existing.lastWornAt,
      isDisliked: req.body.isDisliked ?? existing.isDisliked,
    },
    { existingId: req.params.id, fallbackStatus: existing.status },
  )

  updateWardrobeItem(auth.user.phone, item)
  const nextImageUrls = new Set([item.imageUrl, item.displayImageUrl, item.sourceImageUrl].filter(Boolean))
  const previousImageUrls = [...new Set([existing.imageUrl, existing.displayImageUrl, existing.sourceImageUrl].filter(Boolean))]
  for (const imageUrl of previousImageUrls) {
    if (!nextImageUrls.has(imageUrl)) {
      await removeUploadedFile(uploadsDir, imageUrl)
    }
  }
  res.json(getWardrobeItem(auth.user.phone, req.params.id))
})

app.patch('/api/wardrobe/items/:id/status', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  updateWardrobeStatus(auth.user.phone, req.params.id, req.body.status)
  const bundle = getUserBundle(auth.user.phone)
  const updated = bundle.wardrobe.find((item) => item.id === req.params.id)
  res.json(updated)
})

app.delete('/api/wardrobe/items/:id', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const existing = getWardrobeItem(auth.user.phone, req.params.id)
  if (!existing) {
    res.status(404).json({ message: '衣物不存在' })
    return
  }

  deleteWardrobeItem(auth.user.phone, req.params.id)
  const imageUrls = [...new Set([existing.imageUrl, existing.displayImageUrl, existing.sourceImageUrl].filter(Boolean))]
  for (const imageUrl of imageUrls) {
    await removeUploadedFile(uploadsDir, imageUrl)
  }
  res.json({ ok: true, id: req.params.id })
})

app.post('/api/looks/wear', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const { itemIds = [], wornDate, look } = req.body
  recordLookWear(auth.user.phone, itemIds, wornDate)
  if (look) {
    addSavedLook(auth.user.phone, 'history', look)
  }

  const bundle = getUserBundle(auth.user.phone)
  res.json({ ok: true, wardrobe: bundle.wardrobe })
})

app.post('/api/looks/favorites', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  if (!req.body.look) {
    res.status(400).json({ message: '缺少穿搭内容' })
    return
  }

  const saved = addSavedLook(auth.user.phone, 'favorite', req.body.look)
  res.status(201).json(saved)
})

app.delete('/api/looks/favorites/:id', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  removeSavedLook(auth.user.phone, 'favorite', req.params.id)
  res.json({ ok: true, id: req.params.id })
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`Smart closet API listening on http://127.0.0.1:${port}`)
})
