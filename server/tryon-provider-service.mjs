import path from 'node:path'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { saveGeneratedImageDataUrl } from './image-service.mjs'
import { createMockTryOnPreview } from './tryon-mock-service.mjs'

const DEFAULT_ALIYUN_BASE_URL = 'https://dashscope.aliyuncs.com'
const DEFAULT_ALIYUN_MODEL = 'aitryon'
const DEFAULT_TASK_POLL_INTERVAL = 3000
const DEFAULT_TASK_POLL_LIMIT = 20
const MIN_PROVIDER_IMAGE_BYTES = 5 * 1024

function getTryOnProvider() {
  const provider = process.env.TRYON_PROVIDER?.trim().toLowerCase()
  if (provider === 'aliyun') return 'aliyun'
  if (provider === 'webhook') return 'webhook'
  if (provider === 'doubao') return 'doubao'
  return 'mock'
}

export function getTryOnCapabilities() {
  const provider = getTryOnProvider()
  const supportsOutfitGeneration = Boolean(process.env.DASHSCOPE_API_KEY?.trim())

  if (provider === 'aliyun') {
    return {
      provider,
      supportsSingleGarment: true,
      supportsTopBottomOutfit: true,
      supportsOuterwearLayering: false,
      supportsShoesTryOn: false,
      supportsOutfitGeneration,
    }
  }

  if (provider === 'webhook') {
    return {
      provider,
      supportsSingleGarment: true,
      supportsTopBottomOutfit: String(process.env.TRYON_WEBHOOK_SUPPORTS_TOP_BOTTOM ?? 'true').trim().toLowerCase() !== 'false',
      supportsOuterwearLayering: String(process.env.TRYON_WEBHOOK_SUPPORTS_OUTERWEAR ?? '').trim().toLowerCase() === 'true',
      supportsShoesTryOn: String(process.env.TRYON_WEBHOOK_SUPPORTS_SHOES ?? '').trim().toLowerCase() === 'true',
      supportsOutfitGeneration,
    }
  }

  if (provider === 'doubao') {
    return {
      provider,
      supportsSingleGarment: false,
      supportsTopBottomOutfit: false,
      supportsOuterwearLayering: false,
      supportsShoesTryOn: false,
      supportsOutfitGeneration,
    }
  }

  return {
    provider,
    supportsSingleGarment: true,
    supportsTopBottomOutfit: true,
    supportsOuterwearLayering: false,
    supportsShoesTryOn: false,
    supportsOutfitGeneration,
  }
}

function shouldFallbackToMock() {
  const flag = process.env.TRYON_FALLBACK_TO_MOCK?.trim().toLowerCase()
  return flag !== 'false'
}

function uploadPathFromUrl(uploadsDir, imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) {
    throw new Error('Invalid upload path.')
  }
  return path.join(uploadsDir, imageUrl.slice('/uploads/'.length))
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function remoteImageUrlToDataUrl(imageUrl) {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Failed to fetch generated image: ${response.status} ${errorText}`.trim())
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png'
  const buffer = Buffer.from(await response.arrayBuffer())
  return `data:${contentType};base64,${buffer.toString('base64')}`
}

function mapAliyunCategory(category) {
  if (category === 'look') return 'look'
  if (category === 'top' || category === 'outerwear') return 'top'
  if (category === 'bottom') return 'bottom'
  if (category === 'dress') return 'dress'
  return 'unsupported'
}

function buildAliyunInput(input) {
  const payload = {
    person_image_url: input.personImageOssUrl,
  }

  if (input.topGarmentImageOssUrl || input.bottomGarmentImageOssUrl) {
    return {
      ...payload,
      ...(input.topGarmentImageOssUrl ? { top_garment_url: input.topGarmentImageOssUrl } : {}),
      ...(input.bottomGarmentImageOssUrl ? { bottom_garment_url: input.bottomGarmentImageOssUrl } : {}),
    }
  }

  const category = mapAliyunCategory(input.garmentCategory)

  if (category === 'top') {
    return {
      ...payload,
      top_garment_url: input.garmentImageOssUrl,
    }
  }

  if (category === 'bottom') {
    return {
      ...payload,
      bottom_garment_url: input.garmentImageOssUrl,
    }
  }

  if (category === 'dress') {
    return {
      ...payload,
      top_garment_url: input.garmentImageOssUrl,
    }
  }

  throw new Error('Alibaba AI try-on basic edition currently supports tops, bottoms, and dresses only.')
}

async function getAliyunUploadPolicy({ apiKey, baseUrl, model, fileName }) {
  const query = new URLSearchParams({
    action: 'getPolicy',
    model,
  })

  const response = await fetch(`${baseUrl}/api/v1/uploads?${query.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Failed to get Alibaba upload policy: ${response.status} ${errorText}`.trim())
  }

  return response.json()
}

async function uploadFileToAliyunOss({ uploadPolicy, fileBuffer, fileName, mimeType }) {
  const objectKey = `${uploadPolicy.data.upload_dir}/${fileName}`
  const formData = new FormData()
  formData.set('OSSAccessKeyId', uploadPolicy.data.oss_access_key_id)
  formData.set('Signature', uploadPolicy.data.signature)
  formData.set('policy', uploadPolicy.data.policy)
  formData.set('x-oss-object-acl', uploadPolicy.data.x_oss_object_acl || 'private')
  formData.set('x-oss-forbid-overwrite', uploadPolicy.data.x_oss_forbid_overwrite || 'true')
  formData.set('key', objectKey)
  formData.set('success_action_status', '200')

  const fileBlob = new Blob([fileBuffer], {
    type: mimeType,
  })
  formData.set('file', fileBlob, fileName)

  const response = await fetch(uploadPolicy.data.upload_host, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Failed to upload file to Alibaba temporary storage: ${response.status} ${errorText}`.trim())
  }

  return `oss://${objectKey}`
}

async function prepareAliyunUploadImage(filePath) {
  const baseName = path.basename(filePath, path.extname(filePath))
  const source = sharp(await readFile(filePath)).rotate()
  let normalizedBuffer = await source
    .clone()
    .png()
    .toBuffer()

  if (normalizedBuffer.length < MIN_PROVIDER_IMAGE_BYTES) {
    normalizedBuffer = await source
      .clone()
      .png({
        compressionLevel: 0,
        effort: 1,
        adaptiveFiltering: false,
        palette: false,
      })
      .toBuffer()
  }

  return {
    fileName: `${baseName}.png`,
    fileBuffer: normalizedBuffer,
    mimeType: 'image/png',
  }
}

async function uploadLocalImageForAliyun({ apiKey, baseUrl, model, uploadsDir, imageUrl, prefix }) {
  const filePath = uploadPathFromUrl(uploadsDir, imageUrl)
  const preparedImage = await prepareAliyunUploadImage(filePath)
  const fileName = `${prefix}-${preparedImage.fileName}`
  const policy = await getAliyunUploadPolicy({
    apiKey,
    baseUrl,
    model,
    fileName,
  })
  return uploadFileToAliyunOss({
    uploadPolicy: policy,
    fileBuffer: preparedImage.fileBuffer,
    fileName,
    mimeType: preparedImage.mimeType,
  })
}

async function createAliyunTryOnTask({ apiKey, baseUrl, model, input }) {
  const response = await fetch(`${baseUrl}/api/v1/services/aigc/image2image/image-synthesis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
      'X-DashScope-OssResourceResolve': 'enable',
    },
    body: JSON.stringify({
      model,
      input,
      parameters: {
        resolution: Number(process.env.ALIYUN_TRYON_RESOLUTION ?? -1),
        restore_face: process.env.ALIYUN_TRYON_RESTORE_FACE?.trim().toLowerCase() !== 'false',
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Alibaba AI try-on request failed: ${response.status} ${errorText}`.trim())
  }

  return response.json()
}

async function pollAliyunTask({ apiKey, baseUrl, taskId }) {
  const intervalMs = Number(process.env.ALIYUN_TRYON_POLL_INTERVAL_MS ?? DEFAULT_TASK_POLL_INTERVAL)
  const limit = Number(process.env.ALIYUN_TRYON_POLL_LIMIT ?? DEFAULT_TASK_POLL_LIMIT)

  for (let attempt = 0; attempt < limit; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Alibaba task polling failed: ${response.status} ${errorText}`.trim())
    }

    const payload = await response.json()
    const status = payload.output?.task_status

    if (status === 'SUCCEEDED') {
      return payload
    }

    if (status === 'FAILED' || status === 'CANCELED') {
      const message = payload.output?.message || payload.message || 'Alibaba AI try-on failed.'
      throw new Error(message)
    }

    await sleep(intervalMs)
  }

  throw new Error('Alibaba AI try-on timed out, please try again later.')
}

function getAliyunResultUrl(payload) {
  const candidates = [
    payload?.output?.results?.[0]?.url,
    payload?.output?.results?.[0]?.image_url,
    payload?.output?.result_url,
    payload?.output?.image_url,
  ]

  return candidates.find((entry) => typeof entry === 'string' && entry.trim())?.trim() || ''
}

async function generateWithMock(input) {
  const resultImageUrl = await createMockTryOnPreview(input)
  return {
    provider: 'mock',
    resultImageUrl,
    note: `${input.garmentName} 的展示图已生成，当前使用的是本地演示效果。`,
  }
}

async function generateWithAliyun(input) {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Missing DASHSCOPE_API_KEY, unable to call Alibaba AI try-on.')
  }

  const mappedCategory = mapAliyunCategory(input.garmentCategory)
  if (mappedCategory === 'unsupported') {
    throw new Error('Alibaba AI try-on basic edition does not support shoes or accessories yet.')
  }

  const baseUrl = (process.env.ALIYUN_DASHSCOPE_BASE_URL?.trim() || DEFAULT_ALIYUN_BASE_URL).replace(/\/$/, '')
  const model = process.env.ALIYUN_TRYON_MODEL?.trim() || DEFAULT_ALIYUN_MODEL

  const personImageOssUrl = await uploadLocalImageForAliyun({
    apiKey,
    baseUrl,
    model,
    uploadsDir: input.uploadsDir,
    imageUrl: input.personImageUrl,
    prefix: `${input.phone}-${input.sessionId}-person`,
  })

  const garmentImageOssUrl =
    typeof input.garmentImageUrl === 'string' && input.garmentImageUrl
      ? await uploadLocalImageForAliyun({
          apiKey,
          baseUrl,
          model,
          uploadsDir: input.uploadsDir,
          imageUrl: input.garmentImageUrl,
          prefix: `${input.phone}-${input.sessionId}-garment`,
        })
      : ''

  const topGarmentImageOssUrl =
    typeof input.topGarmentImageUrl === 'string' && input.topGarmentImageUrl
      ? await uploadLocalImageForAliyun({
          apiKey,
          baseUrl,
          model,
          uploadsDir: input.uploadsDir,
          imageUrl: input.topGarmentImageUrl,
          prefix: `${input.phone}-${input.sessionId}-top`,
        })
      : ''

  const bottomGarmentImageOssUrl =
    typeof input.bottomGarmentImageUrl === 'string' && input.bottomGarmentImageUrl
      ? await uploadLocalImageForAliyun({
          apiKey,
          baseUrl,
          model,
          uploadsDir: input.uploadsDir,
          imageUrl: input.bottomGarmentImageUrl,
          prefix: `${input.phone}-${input.sessionId}-bottom`,
        })
      : ''

  const task = await createAliyunTryOnTask({
    apiKey,
    baseUrl,
    model,
    input: buildAliyunInput({
      ...input,
      personImageOssUrl,
      garmentImageOssUrl,
      topGarmentImageOssUrl,
      bottomGarmentImageOssUrl,
    }),
  })

  const taskId = task.output?.task_id || task.output?.taskId || task.task_id
  if (!taskId) {
    throw new Error('Alibaba AI try-on did not return a task ID.')
  }

  const resultPayload = await pollAliyunTask({
    apiKey,
    baseUrl,
    taskId,
  })

  const remoteResultUrl = getAliyunResultUrl(resultPayload)
  if (!remoteResultUrl) {
    throw new Error('Alibaba AI try-on completed but did not return a result image.')
  }

  const resultDataUrl = await remoteImageUrlToDataUrl(remoteResultUrl)
  const resultImageUrl = await saveGeneratedImageDataUrl({
    dataUrl: resultDataUrl,
    phone: input.phone,
    uploadsDir: input.uploadsDir,
  })

  return {
    provider: 'aliyun',
    resultImageUrl,
    note: `${input.garmentName} 的阿里 AI 试衣结果已生成，可直接用于展示。`,
  }
}

async function generateWithWebhook(input) {
  const webhookUrl = process.env.TRYON_WEBHOOK_URL?.trim()
  if (!webhookUrl) {
    throw new Error('TRYON_WEBHOOK_URL is required when TRYON_PROVIDER=webhook.')
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.TRYON_WEBHOOK_TOKEN?.trim()
        ? { Authorization: `Bearer ${process.env.TRYON_WEBHOOK_TOKEN.trim()}` }
        : {}),
    },
    body: JSON.stringify({
      sessionId: input.sessionId,
      phone: input.phone,
      personImageUrl: input.personImageUrl,
      garmentImageUrl: input.garmentImageUrl,
      garmentName: input.garmentName,
      garmentCategory: input.garmentCategory,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Try-on webhook failed: ${response.status} ${errorText}`.trim())
  }

  const payload = await response.json()
  let resultImageUrl = ''

  if (typeof payload.resultImageUrl === 'string' && payload.resultImageUrl.trim()) {
    resultImageUrl = payload.resultImageUrl.trim()
  } else if (typeof payload.dataUrl === 'string' && payload.dataUrl.startsWith('data:image/')) {
    resultImageUrl = await saveGeneratedImageDataUrl({
      dataUrl: payload.dataUrl,
      phone: input.phone,
      uploadsDir: input.uploadsDir,
    })
  } else {
    throw new Error('Try-on webhook response must include resultImageUrl or dataUrl.')
  }

  return {
    provider: 'webhook',
    resultImageUrl,
    note:
      typeof payload.note === 'string' && payload.note.trim()
        ? payload.note.trim()
        : `${input.garmentName} 的展示图已经生成。`,
  }
}

export async function generateTryOnPreview(input) {
  const provider = getTryOnProvider()

  const run =
    provider === 'aliyun'
      ? generateWithAliyun
      : provider === 'webhook'
        ? generateWithWebhook
        : generateWithMock

  try {
    return await run(input)
  } catch (error) {
    if (!shouldFallbackToMock() || provider === 'mock') throw error

    const fallback = await generateWithMock(input)
    return {
      ...fallback,
      note:
        error instanceof Error
          ? `真实生成暂时不可用，已自动回退到演示图。原因：${error.message}`
          : '真实生成暂时不可用，已自动回退到演示图。',
    }
  }
}
