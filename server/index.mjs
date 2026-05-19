import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'

try {
  process.loadEnvFile?.('.env')
} catch {
  // Ignore missing or unreadable local env file in development.
}

import {
  addTryOnSession,
  addSavedLook,
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
import { classifyGarmentImage } from './garment-ai-service.mjs'
import { ensureUploadDir, processAndSaveImage, removeUploadedFile } from './image-service.mjs'
import { sendVerificationCode } from './sms-provider.mjs'
import { createMockTryOnPreview } from './tryon-mock-service.mjs'
import { generateTryOnPreview } from './tryon-provider-service.mjs'
import { cityOptions, fetchCityWeather } from './weather-service.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const uploadsDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, 'uploads')
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

  const user = getUser(session.phone)
  return { user, token }
}

function buildDefaultBundle(phone, nickname) {
  upsertUser(phone, nickname, '上海')
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
    shoulderType: ['narrow', 'regular', 'broad'].includes(input?.shoulderType)
      ? input.shoulderType
      : 'regular',
    waistType: ['defined', 'regular', 'soft'].includes(input?.waistType)
      ? input.waistType
      : 'regular',
    hipType: ['narrow', 'regular', 'curvy'].includes(input?.hipType)
      ? input.hipType
      : 'regular',
    legLengthType: ['shorter', 'regular', 'longer'].includes(input?.legLengthType)
      ? input.legLengthType
      : 'regular',
    tryOnPhotoUrl:
      typeof input?.tryOnPhotoUrl === 'string' && input.tryOnPhotoUrl.trim() ? input.tryOnPhotoUrl.trim() : null,
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
  const { user, token } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '未登录' })
    return
  }

  res.json({
    token,
    user: {
      phone: user.phone,
      nickname: user.nickname,
    },
  })
})

app.post('/api/auth/logout', async (req, res) => {
  const token = getToken(req)
  if (token) deleteSession(token)
  res.json({ ok: true })
})

app.get('/api/bootstrap', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  const bundle = getUserBundle(user.phone)
  res.json({
    selectedCity: bundle.user.selectedCity,
    preferences: bundle.preferences,
    avatarProfile: bundle.avatarProfile,
    wardrobe: bundle.wardrobe,
    history: bundle.history,
    favorites: bundle.favorites,
    tryOnSessions: bundle.tryOnSessions,
    cities: cityOptions.map((entry) => ({ city: entry.city })),
    user: {
      phone: bundle.user.phone,
      nickname: bundle.user.nickname,
    },
  })
})

app.get('/api/avatar-profile', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '璇峰厛鐧诲綍' })
    return
  }

  res.json(getAvatarProfile(user.phone))
})

app.put('/api/avatar-profile', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '璇峰厛鐧诲綍' })
    return
  }

  const profile = normalizeAvatarProfile(req.body)
  upsertAvatarProfile(user.phone, profile)
  res.json(profile)
})

app.get('/api/try-on/sessions', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '璇峰厛鐧诲綍' })
    return
  }

  res.json(getTryOnSessions(user.phone))
})

app.post('/api/try-on/sessions', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '璇峰厛鐧诲綍' })
    return
  }

  const garmentItemId = String(req.body.garmentItemId ?? '').trim()
  if (!garmentItemId) {
    res.status(400).json({ message: '缂哄皯瑕佽瘯绌跨殑琛ｇ墿' })
    return
  }

  const bundle = getUserBundle(user.phone)
  const garmentItem = bundle?.wardrobe.find((item) => item.id === garmentItemId)
  if (!garmentItem?.imageUrl) {
    res.status(400).json({ message: '杩欎欢琛ｇ墿杩樻病鏈夊彲鐢ㄧ殑鍗曞搧鍥? })
    return
  }

  if (!bundle?.avatarProfile?.tryOnPhotoUrl) {
    res.status(400).json({ message: '璇峰厛涓婁紶鏈汉璇曠┛鍙傝€冪収' })
    return
  }

  const session = addTryOnSession(user.phone, {
    garmentItemId,
    personImageUrl: bundle.avatarProfile.tryOnPhotoUrl,
    garmentImageUrl: garmentItem.imageUrl,
    provider: null,
    status: 'draft_ready',
    note: `已为 ${garmentItem.name} 准备好预览素材，可以继续生成上身效果。`,
  })

  res.status(201).json(session)
})

app.post('/api/try-on/sessions/:id/mock-preview', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '璇峰厛鐧诲綍' })
    return
  }

  const existing = getTryOnSession(user.phone, req.params.id)
  if (!existing) {
    res.status(404).json({ message: '璇曠┛浠诲姟涓嶅瓨鍦? })
    return
  }

  const garmentItem = getWardrobeItem(user.phone, existing.garmentItemId)
  if (!garmentItem?.imageUrl) {
    res.status(400).json({ message: '杩欎欢琛ｇ墿杩樻病鏈夊彲鐢ㄥ浘鐗? })
    return
  }

  try {
    const resultImageUrl = await createMockTryOnPreview({
      uploadsDir,
      personImageUrl: existing.personImageUrl,
      garmentImageUrl: existing.garmentImageUrl,
      garmentName: garmentItem.name,
      phone: user.phone,
      sessionId: existing.id,
    })

    const updated = updateTryOnSession(user.phone, existing.id, {
      resultImageUrl,
      status: 'completed',
      note: `${garmentItem.name} 的预览已经生成好了，可以先用来展示整体效果。`,
    })

    res.json(updated)
  } catch (error) {
    const updated = updateTryOnSession(user.phone, existing.id, {
      resultImageUrl: existing.resultImageUrl ?? null,
      status: 'failed',
      note: error instanceof Error ? error.message : 'Mock 预览生成失败',
    })
    res.status(500).json(updated)
  }
})

app.post('/api/try-on/sessions/:id/generate', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '鐠囧嘲鍘涢惂璇茬秿' })
    return
  }

  const existing = getTryOnSession(user.phone, req.params.id)
  if (!existing) {
    res.status(404).json({ message: '鐠囨洜鈹涙禒璇插娑撳秴鐡ㄩ崷? })
    return
  }

  const garmentItem = getWardrobeItem(user.phone, existing.garmentItemId)
  if (!garmentItem?.imageUrl) {
    res.status(400).json({ message: '鏉╂瑤娆㈢悰锝囧⒖鏉╂ɑ鐥呴張澶婂讲閻劌娴橀悧? })
    return
  }

  try {
    updateTryOnSession(user.phone, existing.id, {
      resultImageUrl: existing.resultImageUrl ?? null,
      provider: existing.provider ?? null,
      status: 'processing',
      note: `正在为 ${garmentItem.name} 生成预览，请稍等片刻。`,
    })

    const generated = await generateTryOnPreview({
      uploadsDir,
      personImageUrl: existing.personImageUrl,
      garmentImageUrl: existing.garmentImageUrl,
      garmentName: garmentItem.name,
      phone: user.phone,
      sessionId: existing.id,
    })

    const updated = updateTryOnSession(user.phone, existing.id, {
      resultImageUrl: generated.resultImageUrl,
      provider: generated.provider,
      status: 'completed',
      note: generated.note,
    })

    res.json(updated)
  } catch (error) {
    const updated = updateTryOnSession(user.phone, existing.id, {
      resultImageUrl: existing.resultImageUrl ?? null,
      provider: existing.provider ?? null,
      status: 'failed',
      note: error instanceof Error ? error.message : 'Try-on preview generation failed',
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
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  const dataUrl = String(req.body.dataUrl ?? '')
  const processingMode = req.body.processingMode === 'subject' ? 'subject' : 'standard'
  try {
    const result = await processAndSaveImage({
      dataUrl,
      phone: user.phone,
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
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  const dataUrl = String(req.body.dataUrl ?? '')
  const processingMode = req.body.processingMode === 'subject' ? 'subject' : 'standard'
  if (!dataUrl.startsWith('data:image/')) {
    res.status(400).json({ message: '请上传有效图片' })
    return
  }

  try {
    const [uploadResult, draft] = await Promise.all([
      processAndSaveImage({
        dataUrl,
        phone: user.phone,
        uploadsDir,
        processingMode,
      }),
      classifyGarmentImage(dataUrl).catch(() => null),
    ])

    res.status(201).json({
      imageUrl: uploadResult.imageUrl,
      processingMode: uploadResult.processingMode,
      draft,
      subjectStats: uploadResult.subjectStats,
      needsConfirmation:
        !draft ||
        draft.confidence < 0.8 ||
        (uploadResult.subjectStats?.componentCount ?? 0) > 1,
    })
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : '图片处理失败',
    })
  }
})

app.post('/api/vision/garment-draft', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '璇峰厛鐧诲綍' })
    return
  }

  const dataUrl = String(req.body.dataUrl ?? '')
  if (!dataUrl.startsWith('data:image/')) {
    res.status(400).json({ message: '璇蜂笂浼犳湁鏁堢殑鍥剧墖' })
    return
  }

  try {
    const result = await classifyGarmentImage(dataUrl)
    res.json({ draft: result })
  } catch (error) {
    res.status(502).json({
      message: error instanceof Error ? error.message : '鍥剧墖璇嗗埆澶辫触',
    })
  }
})

app.put('/api/selected-city', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  updateSelectedCity(user.phone, req.body.city ?? user.selectedCity)
  res.json({ selectedCity: req.body.city ?? user.selectedCity })
})

app.put('/api/preferences', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  upsertPreferences(user.phone, req.body)
  res.json(req.body)
})

app.post('/api/wardrobe/items', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  const item = { ...req.body, id: req.body.id ?? `item-${crypto.randomUUID()}` }
  addWardrobeItem(user.phone, item)
  res.status(201).json(item)
})

app.put('/api/wardrobe/items/:id', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  const existing = getWardrobeItem(user.phone, req.params.id)
  if (!existing) {
    res.status(404).json({ message: '衣物不存在' })
    return
  }

  const item = {
    ...existing,
    ...req.body,
    id: req.params.id,
  }

  updateWardrobeItem(user.phone, item)
  if (existing.imageUrl && existing.imageUrl !== item.imageUrl) {
    await removeUploadedFile(uploadsDir, existing.imageUrl)
  }
  res.json(getWardrobeItem(user.phone, req.params.id))
})

app.patch('/api/wardrobe/items/:id/status', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  updateWardrobeStatus(user.phone, req.params.id, req.body.status)
  const bundle = getUserBundle(user.phone)
  const updated = bundle.wardrobe.find((item) => item.id === req.params.id)
  res.json(updated)
})

app.delete('/api/wardrobe/items/:id', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  const existing = getWardrobeItem(user.phone, req.params.id)
  if (!existing) {
    res.status(404).json({ message: '衣物不存在' })
    return
  }

  deleteWardrobeItem(user.phone, req.params.id)
  await removeUploadedFile(uploadsDir, existing.imageUrl)
  res.json({ ok: true, id: req.params.id })
})

app.post('/api/looks/wear', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  const { itemIds = [], wornDate, look } = req.body
  recordLookWear(user.phone, itemIds, wornDate)
  if (look) {
    addSavedLook(user.phone, 'history', look)
  }

  const bundle = getUserBundle(user.phone)
  res.json({ ok: true, wardrobe: bundle.wardrobe })
})

app.post('/api/looks/favorites', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  if (!req.body.look) {
    res.status(400).json({ message: '缺少穿搭内容' })
    return
  }

  const saved = addSavedLook(user.phone, 'favorite', req.body.look)
  res.status(201).json(saved)
})

app.delete('/api/looks/favorites/:id', async (req, res) => {
  const { user } = getAuthedUser(req)
  if (!user) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  removeSavedLook(user.phone, 'favorite', req.params.id)
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
