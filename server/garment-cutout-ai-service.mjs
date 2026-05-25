import sharp from 'sharp'

const CATEGORY_PROMPTS = {
  top:
    '原样提取这件上衣主体。保留领口、肩线、袖子、门襟、纽扣、下摆、纹理和logo。删除人物、手、内搭、裤子、背景、水印和杂物。不要重绘，不要美化，不要改变长度、版型、领型、袖长、颜色和图案。如果无法完全干净分离，优先保留真实边缘，不要生成相似替代品。',
  bottom:
    '原样提取这件下装主体。保留腰头、裤腿或裙摆、口袋、褶皱、长度、纹理和logo。删除人物、腿、上衣、鞋子、背景、水印和杂物。不要重绘，不要美化，不要改变裤型、裙型、长度、廓形、颜色和图案。如果无法完全干净分离，优先保留真实边缘，不要生成相似替代品。',
  outerwear:
    '原样提取这件外套主体。保留翻领、肩线、袖子、门襟、口袋、下摆、纹理和logo。删除人物、手、内搭、裤子、背景、水印和杂物。不要重绘，不要美化，不要改变长度、版型、领型、袖长、颜色和图案。如果无法完全干净分离，优先保留真实边缘，不要生成相似替代品。',
  dress:
    '原样提取这件连衣裙主体。保留领口、肩线、袖子、腰线、裙摆、长度、纹理和logo。删除人物、手、腿、鞋子、外套、背景、水印和杂物。不要重绘，不要美化，不要改变裙长、版型、领型、袖长、颜色和图案。如果无法完全干净分离，优先保留真实边缘，不要生成相似替代品。',
  shoes:
    '原样提取目标鞋子主体。如果原图里是一双鞋，尽量完整保留这一双鞋和原始相对位置。保留鞋头、鞋舌、鞋带、鞋帮、鞋底、鞋跟、纹理和logo。删除腿、袜子、裙摆、裤脚、手、背景、水印和杂物。不要重绘，不要美化，不要改变鞋型、鞋带走向、颜色和细节，不要把一双鞋改成一只。如果无法完全干净分离，优先保留真实边缘，不要生成新的鞋子。',
  accessory:
    '原样提取目标配饰主体。保留轮廓、结构、材质、五金、纹理和logo。删除人物、手、衣物、背景、水印和杂物。不要重绘，不要美化，不要改变大小、颜色和结构。如果无法完全干净分离，优先保留真实边缘，不要生成相似替代品。',
  default:
    '原样提取目标单品主体。保留原始轮廓、结构、长度、纹理和logo。删除人物、背景、水印和无关杂物。不要重绘，不要美化，不要改变款式、颜色和比例。如果无法完全干净分离，优先保留真实边缘，不要生成相似替代品。',
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

function buildGarmentEditPrompt(categoryHint = '') {
  const category = String(categoryHint).trim().toLowerCase()
  return CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.default
}

export async function enhanceGarmentImageWithAi(dataUrl, categoryHint = '') {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim()
  if (!apiKey || !dataUrl.startsWith('data:image/')) return null

  const baseUrl = process.env.WANX_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com/api/v1'
  const endpoint = `${baseUrl.replace(/\/$/, '')}/services/aigc/multimodal-generation/generation`
  const model = process.env.GARMENT_EDIT_MODEL?.trim() || 'wan2.7-image-pro'
  const normalizedImage = await normalizeForWan(dataUrl)
  const prompt = buildGarmentEditPrompt(categoryHint)

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
            content: [{ image: normalizedImage }, { text: prompt }],
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
