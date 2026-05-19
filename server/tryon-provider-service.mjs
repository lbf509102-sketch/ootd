import { saveGeneratedImageDataUrl } from './image-service.mjs'
import { createMockTryOnPreview } from './tryon-mock-service.mjs'

function getTryOnProvider() {
  const provider = process.env.TRYON_PROVIDER?.trim().toLowerCase()
  return provider === 'webhook' ? 'webhook' : 'mock'
}

function shouldFallbackToMock() {
  const flag = process.env.TRYON_FALLBACK_TO_MOCK?.trim().toLowerCase()
  return flag !== 'false'
}

async function generateWithMock(input) {
  const resultImageUrl = await createMockTryOnPreview(input)
  return {
    provider: 'mock',
    resultImageUrl,
    note: `Mock 预览已生成，当前展示的是 ${input.garmentName} 的试穿占位图，后面可切换成真实模型输出。`,
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
        : `已通过 webhook 生成 ${input.garmentName} 的试穿预览。`,
  }
}

export async function generateTryOnPreview(input) {
  const provider = getTryOnProvider()
  if (provider !== 'webhook') {
    return generateWithMock(input)
  }

  try {
    return await generateWithWebhook(input)
  } catch (error) {
    if (!shouldFallbackToMock()) throw error

    const fallback = await generateWithMock(input)
    return {
      ...fallback,
      note:
        error instanceof Error
          ? `Webhook 暂时不可用，已自动回退到 mock 预览。原因：${error.message}`
          : 'Webhook 暂时不可用，已自动回退到 mock 预览。',
    }
  }
}
