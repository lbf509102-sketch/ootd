import sharp from 'sharp'

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

async function normalizeForWan(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return dataUrl

  const normalized = await sharp(Buffer.from(match[2], 'base64'))
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 94 })
    .toBuffer()

  return `data:image/jpeg;base64,${normalized.toString('base64')}`
}

export async function enhanceGarmentImageWithAi(dataUrl) {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim()
  if (!apiKey || !dataUrl.startsWith('data:image/')) return null

  const baseUrl = process.env.WANX_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com/api/v1'
  const endpoint = `${baseUrl.replace(/\/$/, '')}/services/aigc/multimodal-generation/generation`
  const model = process.env.GARMENT_EDIT_MODEL?.trim() || 'wan2.7-image-pro'
  const normalizedImage = await normalizeForWan(dataUrl)

  const prompt =
    '把这张图整理成服装电商单品图。只保留一件完整衣服主体，完整保留领口、肩线、袖口、下摆、褶皱、版型和面料细节。' +
    '删除衣架、挂钩、夹子、支撑杆、模特、手部、背景、阴影和所有杂物。' +
    '不要裁掉衣服，不要新增配饰，不要改变衣服款式、长度、领口或廓形，不要复制主体。' +
    '让衣服居中、竖直、边缘自然干净。' +
    '输出纯净、统一、无纹理、无渐变的中性暖灰背景，背景亮度要明显深于浅色衣服，确保白色或米色衣服也有清晰边界，方便后续透明抠图。'

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
            content: [
              { image: normalizedImage },
              { text: prompt },
            ],
          },
        ],
      },
      parameters: {
        size: process.env.GARMENT_EDIT_SIZE?.trim() || '1K',
        n: 1,
        watermark: false,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Wan image edit failed: ${response.status} ${errorText}`.trim())
  }

  const payload = await response.json()
  const imageUrl = extractImageUrl(payload)
  if (!imageUrl) {
    throw new Error('Wan image edit returned no image URL.')
  }

  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download Wan result: ${imageResponse.status}`)
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
  return {
    buffer: imageBuffer,
    model,
    imageUrl,
  }
}
