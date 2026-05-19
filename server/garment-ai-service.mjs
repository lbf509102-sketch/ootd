import sharp from 'sharp'

const allowedCategories = ['top', 'bottom', 'outerwear', 'shoes', 'dress', 'accessory']
const allowedColors = ['black_white_gray', 'blue', 'khaki_brown', 'denim', 'accent']
const allowedThickness = ['light', 'regular', 'warm']
const allowedStyles = ['commute', 'casual', 'refined']
const allowedSeasons = ['summer', 'spring_autumn', 'winter', 'all_season']
const allowedFitTypes = ['slim', 'regular', 'relaxed']
const allowedGarmentLengths = ['short', 'regular', 'long', 'midi', 'maxi']
const allowedSleeveLengths = ['sleeveless', 'short', 'three_quarter', 'long', 'na']
const allowedSilhouettes = ['fitted', 'straight', 'relaxed', 'a_line']
const categoryNames = {
  top: '上衣',
  bottom: '下装',
  outerwear: '外套',
  shoes: '鞋子',
  dress: '连衣裙',
  accessory: '配饰',
}
const colorNames = {
  black_white_gray: '黑白灰',
  blue: '蓝色',
  khaki_brown: '卡其棕',
  denim: '牛仔',
  accent: '亮色',
}

function sanitizeEnum(value, allowed, fallback) {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback
}

function extractJsonBlock(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1]
  const objectMatch = text.match(/\{[\s\S]*\}/)
  return objectMatch ? objectMatch[0] : ''
}

function containsMostlyLatin(text) {
  if (typeof text !== 'string') return false
  const asciiLetters = (text.match(/[A-Za-z]/g) ?? []).length
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  return asciiLetters > 0 && asciiLetters >= chineseChars
}

function buildChineseName(category, colorGroup) {
  return `${colorNames[colorGroup] ?? '基础色'}${categoryNames[category] ?? '单品'}`
}

function inferVisualMeta(category, fitType) {
  const silhouette = fitType === 'slim' ? 'fitted' : fitType === 'relaxed' ? 'relaxed' : category === 'dress' ? 'a_line' : 'straight'

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

async function normalizeImageDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return dataUrl

  const bytes = Buffer.from(match[2], 'base64')
  const normalized = await sharp(bytes)
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 92 })
    .toBuffer()

  return `data:image/jpeg;base64,${normalized.toString('base64')}`
}

export async function classifyGarmentImage(dataUrl) {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  if (!apiKey || !dataUrl.startsWith('data:image/')) return null

  const model = process.env.GARMENT_VISION_MODEL?.trim() || 'qwen3.6-plus'
  const baseUrl =
    process.env.GARMENT_AI_BASE_URL?.trim() ||
    (process.env.DASHSCOPE_API_KEY?.trim()
      ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      : 'https://api.openai.com/v1')
  const isDashScope = /dashscope\.aliyuncs\.com/i.test(baseUrl)
  const imagePayload = isDashScope ? await normalizeImageDataUrl(dataUrl) : dataUrl
  const prompt =
    '你在为一个中文衣橱应用识别单件服装图片。只返回 JSON，不要返回代码块、解释或额外文字。' +
    'JSON 必须只包含这些键：category, colorGroup, thickness, style, seasonFit, fitType, garmentLength, sleeveLength, silhouette, name, note, confidence。' +
    '允许的 category：top, bottom, outerwear, shoes, dress, accessory。' +
    '允许的 colorGroup：black_white_gray, blue, khaki_brown, denim, accent。' +
    '允许的 thickness：light, regular, warm。' +
    '允许的 style：commute, casual, refined。' +
    '允许的 seasonFit：summer, spring_autumn, winter, all_season。' +
    '允许的 fitType：slim, regular, relaxed。' +
    '允许的 garmentLength：short, regular, long, midi, maxi。' +
    '允许的 sleeveLength：sleeveless, short, three_quarter, long, na。' +
    '允许的 silhouette：fitted, straight, relaxed, a_line。' +
    '只有连体裙装才使用 category=dress；半裙和裤子必须使用 category=bottom。' +
    '鞋子和配饰的 sleeveLength 必须是 na。' +
    'name 和 note 必须使用简体中文，不能使用英文、拼音或中英混写。' +
    'name 要简短自然，像商品名，例如“奶油白无袖褶皱连衣裙”。' +
    'note 只写一句简短中文说明。' +
    '如果图片不是单件清晰服装，confidence 必须低于 0.55，并在 note 里用中文简要说明原因。'

  const requestBody = isDashScope
    ? {
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imagePayload } },
            ],
          },
        ],
        max_tokens: 400,
      }
    : {
        model,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: imagePayload, detail: 'high' },
            ],
          },
        ],
        max_output_tokens: 400,
      }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/${isDashScope ? 'chat/completions' : 'responses'}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Vision provider failed: ${response.status} ${errorText}`.trim())
  }

  const payload = await response.json()
  const outputText = isDashScope
    ? payload.choices?.[0]?.message?.content ?? ''
    : payload.output_text ||
      payload.output?.flatMap((entry) => entry.content ?? []).map((entry) => entry.text ?? '').join('\n') ||
      ''
  const jsonText = extractJsonBlock(outputText)
  if (!jsonText) return null

  const parsed = JSON.parse(jsonText)
  const confidence = Number(parsed.confidence ?? 0)
  const category = sanitizeEnum(parsed.category, allowedCategories, 'top')
  const colorGroup = sanitizeEnum(parsed.colorGroup, allowedColors, 'black_white_gray')
  const fitType = sanitizeEnum(parsed.fitType, allowedFitTypes, 'regular')
  const inferredMeta = inferVisualMeta(category, fitType)
  const normalizedName =
    typeof parsed.name === 'string' && parsed.name.trim() && !containsMostlyLatin(parsed.name)
      ? parsed.name.trim()
      : buildChineseName(category, colorGroup)
  const normalizedNote =
    typeof parsed.note === 'string' && parsed.note.trim() && !containsMostlyLatin(parsed.note)
      ? parsed.note.trim()
      : `识别为${categoryNames[category]}，保存前请确认领口、长度和面料细节。`

  return {
    provider: isDashScope ? 'qwen' : 'openai',
    category,
    colorGroup,
    thickness: sanitizeEnum(parsed.thickness, allowedThickness, 'regular'),
    style: sanitizeEnum(parsed.style, allowedStyles, 'commute'),
    seasonFit: sanitizeEnum(parsed.seasonFit, allowedSeasons, 'spring_autumn'),
    fitType,
    garmentLength: sanitizeEnum(parsed.garmentLength, allowedGarmentLengths, inferredMeta.garmentLength),
    sleeveLength: sanitizeEnum(parsed.sleeveLength, allowedSleeveLengths, inferredMeta.sleeveLength),
    silhouette: sanitizeEnum(parsed.silhouette, allowedSilhouettes, inferredMeta.silhouette),
    name: normalizedName,
    note: normalizedNote,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
  }
}

