async function sendViaMock(phone, code) {
  return {
    ok: true,
    provider: 'mock',
    devCode: code,
    message: `开发环境固定验证码为 ${code}`,
    phone,
  }
}

async function sendViaWebhook(phone, code) {
  const endpoint = process.env.SMS_WEBHOOK_URL?.trim()
  if (!endpoint) {
    throw new Error('SMS_WEBHOOK_URL 未配置')
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
    throw new Error(`短信服务请求失败：${response.status}`)
  }

  return {
    ok: true,
    provider: 'webhook',
    message: '验证码已发送',
    phone,
  }
}

export async function sendVerificationCode(phone, code) {
  const provider = process.env.SMS_PROVIDER?.trim() || 'mock'

  if (provider === 'webhook') {
    return sendViaWebhook(phone, code)
  }

  return sendViaMock(phone, code)
}
