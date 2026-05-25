function buildMockPayload(phone, code, reason = '') {
  const suffix = reason ? `，已切换为演示验证码 ${code}` : `，演示验证码 ${code}`
  return {
    ok: true,
    provider: 'mock',
    devCode: code,
    message: `短信服务暂时不可用${suffix}`,
    phone,
  }
}

async function sendViaMock(phone, code) {
  return buildMockPayload(phone, code)
}

async function sendViaWebhook(phone, code) {
  const endpoint = process.env.SMS_WEBHOOK_URL?.trim()
  if (!endpoint) {
    throw new Error('短信服务未配置')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.SMS_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      phone,
      code,
      template: process.env.SMS_TEMPLATE_ID ?? 'smart-closet-login',
    }),
  })

  if (!response.ok) {
    throw new Error(`短信服务请求失败 ${response.status}`)
  }

  return {
    ok: true,
    provider: 'webhook',
    devCode: code,
    message: `验证码已发送，演示环境也可直接使用 ${code}`,
    phone,
  }
}

export async function sendVerificationCode(phone, code) {
  const provider = process.env.SMS_PROVIDER?.trim() || 'mock'
  const fallbackToMock = (process.env.SMS_FALLBACK_TO_MOCK?.trim() || 'true') !== 'false'

  if (provider === 'webhook') {
    try {
      return await sendViaWebhook(phone, code)
    } catch (error) {
      if (!fallbackToMock) {
        throw error
      }

      const reason = error instanceof Error ? error.message : '发送失败'
      return buildMockPayload(phone, code, reason)
    }
  }

  return sendViaMock(phone, code)
}
