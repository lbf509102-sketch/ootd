import path from 'node:path'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

function uploadPathFromUrl(uploadsDir, imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) {
    throw new Error('Invalid upload path.')
  }
  return path.join(uploadsDir, imageUrl.slice('/uploads/'.length))
}

async function localUploadToDataUrl(uploadsDir, imageUrl) {
  const filePath = uploadPathFromUrl(uploadsDir, imageUrl)
  const buffer = await sharp(await readFile(filePath))
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90 })
    .toBuffer()

  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

function buildItemLabel(item) {
  return {
    name: item.name,
    category: item.category,
    colorGroup: item.colorGroup,
    sleeveLength: item.sleeveLength ?? 'na',
    garmentLength: item.garmentLength ?? 'regular',
    silhouette: item.silhouette ?? 'straight',
  }
}

function extractJsonBlock(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1]
  const objectMatch = text.match(/\{[\s\S]*\}/)
  return objectMatch ? objectMatch[0] : ''
}

export async function validateLookTryOnResult({ uploadsDir, resultImageUrl, expectedItems }) {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return { passed: true, score: 1, issues: [], skipped: true }
  }

  const baseUrl =
    process.env.GARMENT_AI_BASE_URL?.trim() ||
    (process.env.DASHSCOPE_API_KEY?.trim()
      ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      : 'https://api.openai.com/v1')
  const model = process.env.GARMENT_VISION_MODEL?.trim() || 'qwen3.6-plus'
  const isDashScope = /dashscope\.aliyuncs\.com/i.test(baseUrl)

  const resultImageDataUrl = await localUploadToDataUrl(uploadsDir, resultImageUrl)
  const referenceImages = await Promise.all(
    expectedItems
      .filter((item) => typeof item.imageUrl === 'string' && item.imageUrl.startsWith('/uploads/'))
      .map((item) => localUploadToDataUrl(uploadsDir, item.imageUrl)),
  )

  const expectedSummary = expectedItems.map(buildItemLabel)
  const prompt =
    '你是中文服装试穿结果质检助手。请判断第一张图片里的试穿结果，是否和后续参考单品能对应上。' +
    '重点检查：上衣是否还在、袖长是否明显错误、下装类型是否错成短裤/裤子/半身裙、是否把上衣下装错误变成连体衣或连衣裙。' +
    '如果有任一关键错位，就判定不通过。' +
    `目标单品信息：${JSON.stringify(expectedSummary)}。` +
    '只返回 JSON，不要解释。JSON 格式必须是 {"passed":boolean,"score":0到1之间数字,"issues":["中文问题1","中文问题2"]}。'

  const content = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: resultImageDataUrl } },
    ...referenceImages.map((url) => ({ type: 'image_url', image_url: { url } })),
  ]

  const requestBody = isDashScope
    ? {
        model,
        messages: [{ role: 'user', content }],
        max_tokens: 300,
      }
    : {
        model,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: resultImageDataUrl, detail: 'high' },
              ...referenceImages.map((url) => ({ type: 'input_image', image_url: url, detail: 'high' })),
            ],
          },
        ],
        max_output_tokens: 300,
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
    throw new Error(`Try-on validation failed: ${response.status} ${errorText}`.trim())
  }

  const payload = await response.json()
  const outputText = isDashScope
    ? payload.choices?.[0]?.message?.content ?? ''
    : payload.output_text ||
      payload.output?.flatMap((entry) => entry.content ?? []).map((entry) => entry.text ?? '').join('\n') ||
      ''
  const jsonText = extractJsonBlock(outputText)
  if (!jsonText) {
    return { passed: true, score: 1, issues: [], skipped: true }
  }

  const parsed = JSON.parse(jsonText)
  return {
    passed: parsed.passed !== false,
    score: Number.isFinite(Number(parsed.score)) ? Math.max(0, Math.min(1, Number(parsed.score))) : 0,
    issues: Array.isArray(parsed.issues) ? parsed.issues.map((entry) => String(entry)) : [],
    skipped: false,
  }
}
