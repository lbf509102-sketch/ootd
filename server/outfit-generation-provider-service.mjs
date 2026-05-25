import path from 'node:path'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { saveGeneratedImageDataUrl } from './image-service.mjs'

const DEFAULT_WANX_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'
const DEFAULT_OUTFIT_MODEL = 'wan2.7-image-pro'

function uploadPathFromUrl(uploadsDir, imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) {
    throw new Error('Invalid upload path.')
  }
  return path.join(uploadsDir, imageUrl.slice('/uploads/'.length))
}

async function localUploadToDataUrl(uploadsDir, imageUrl) {
  const filePath = uploadPathFromUrl(uploadsDir, imageUrl)
  const source = sharp(await readFile(filePath)).rotate().resize({
    width: 1600,
    height: 1600,
    fit: 'inside',
    withoutEnlargement: true,
  })
  const buffer = await source.jpeg({ quality: 94 }).toBuffer()
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

function extractImageUrl(payload) {
  const choices = payload?.output?.choices
  if (!Array.isArray(choices)) return ''

  for (const choice of choices) {
    const content = choice?.message?.content
    if (!Array.isArray(content)) continue

    for (const entry of content) {
      if (typeof entry?.image === 'string' && entry.image) return entry.image
    }
  }

  return ''
}

function buildOutfitPrompt({ garments, sceneHint = '' }) {
  const garmentSummary = garments.map((item) => `${item.category}:${item.name}`).join('；')
  const sceneSentence = sceneHint ? `整体氛围参考：${sceneHint}。` : ''

  return [
    '第一张图是人物参考照，后续图片是需要穿到这个人身上的服装单品。',
    '请保持人物身份、脸部、发型、站姿和拍摄视角基本一致。',
    '把后续提供的所有服装尽量完整穿到人物身上，生成一张完整穿搭效果图。',
    '优先保留每件衣服/鞋子的颜色、版型、长度、材质和关键细节，不要随意改款。',
    '如果同时提供了外套、鞋子、上衣、下装，请组合成一套自然合理的完整穿搭。',
    '输出应为单人全身效果图，背景尽量干净自然。',
    sceneSentence,
    `服装清单：${garmentSummary}。`,
  ]
    .filter(Boolean)
    .join(' ')
}

export async function generateOutfitPreview(input) {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Missing DASHSCOPE_API_KEY, unable to generate full outfit preview.')
  }

  if (!Array.isArray(input.garments) || input.garments.length === 0) {
    throw new Error('At least one garment is required for outfit generation.')
  }

  const baseUrl = (process.env.WANX_BASE_URL?.trim() || DEFAULT_WANX_BASE_URL).replace(/\/$/, '')
  const endpoint = `${baseUrl}/services/aigc/multimodal-generation/generation`
  const model = process.env.OUTFIT_GENERATION_MODEL?.trim() || process.env.GARMENT_EDIT_MODEL?.trim() || DEFAULT_OUTFIT_MODEL

  const personImage = await localUploadToDataUrl(input.uploadsDir, input.personImageUrl)
  const garmentImages = await Promise.all(
    input.garments.map((garment) => localUploadToDataUrl(input.uploadsDir, garment.imageUrl)),
  )

  const content = [{ image: personImage }, ...garmentImages.map((image) => ({ image })), { text: buildOutfitPrompt(input) }]

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: {
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      },
      parameters: {
        size: process.env.OUTFIT_GENERATION_SIZE?.trim() || process.env.GARMENT_EDIT_SIZE?.trim() || '1K',
        n: 1,
        watermark: false,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Wan outfit generation failed: ${response.status} ${errorText}`.trim())
  }

  const payload = await response.json()
  const remoteImageUrl = extractImageUrl(payload)
  if (!remoteImageUrl) {
    throw new Error('Wan outfit generation returned no image URL.')
  }

  const imageResponse = await fetch(remoteImageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download Wan outfit result: ${imageResponse.status}`)
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
  const resultDataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
  const resultImageUrl = await saveGeneratedImageDataUrl({
    dataUrl: resultDataUrl,
    phone: input.phone,
    uploadsDir: input.uploadsDir,
  })

  return {
    provider: 'wan',
    resultImageUrl,
    note: `${input.garments.map((item) => item.name).join(' + ')} 的整套效果图已经生成好了。`,
  }
}
