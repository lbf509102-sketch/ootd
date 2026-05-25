import path from 'node:path'
import sharp from 'sharp'

function uploadPathFromUrl(uploadsDir, imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) {
    throw new Error('Invalid upload path.')
  }
  return path.join(uploadsDir, imageUrl.slice('/uploads/'.length))
}

export async function addShoesToTryOnResult({
  uploadsDir,
  resultImageUrl,
  shoeImageUrl,
  shoeName = '推荐鞋子',
  phone,
  sessionId,
}) {
  const resultPath = uploadPathFromUrl(uploadsDir, resultImageUrl)
  const shoePath = uploadPathFromUrl(uploadsDir, shoeImageUrl)
  const fileName = `${phone}-${Date.now()}-${sessionId}-with-shoes.webp`
  const outputPath = path.join(uploadsDir, fileName)

  const baseImage = sharp(resultPath).rotate()
  const metadata = await baseImage.metadata()
  const width = Number(metadata.width ?? 0)
  const height = Number(metadata.height ?? 0)

  if (!width || !height) {
    throw new Error('Unable to read try-on result size.')
  }

  const panelWidth = Math.round(width * 0.28)
  const panelHeight = Math.round(height * 0.24)
  const shoeWidth = Math.round(panelWidth * 0.72)
  const shoeHeight = Math.round(panelHeight * 0.42)

  const shoeLayer = await sharp(shoePath)
    .rotate()
    .resize(shoeWidth, shoeHeight, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const panelBase = await sharp({
    create: {
      width: panelWidth,
      height: panelHeight,
      channels: 4,
      background: { r: 255, g: 250, b: 244, alpha: 0.94 },
    },
  })
    .png()
    .toBuffer()

  const panelShadow = await sharp(panelBase)
    .blur(18)
    .modulate({ brightness: 0.76, saturation: 0.82 })
    .png()
    .toBuffer()

  const safeShoeName = String(shoeName)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const panelOverlay = Buffer.from(`
    <svg width="${panelWidth}" height="${panelHeight}" viewBox="0 0 ${panelWidth} ${panelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="18" width="92" height="28" rx="14" fill="rgba(217,143,95,0.18)" />
      <text x="40" y="37" font-size="14" font-family="Arial, sans-serif" fill="#a06134">推荐鞋</text>
      <text x="24" y="${panelHeight - 48}" font-size="18" font-family="Arial, sans-serif" font-weight="700" fill="#213131">${safeShoeName}</text>
      <text x="24" y="${panelHeight - 24}" font-size="13" font-family="Arial, sans-serif" fill="#5f675f">当前以搭配参考展示，不强行伪装成真实上脚。</text>
    </svg>
  `)

  const shoeShadow = await sharp(shoeLayer)
    .blur(10)
    .modulate({ brightness: 0.46, saturation: 0.48 })
    .png()
    .toBuffer()

  const panelLeft = Math.round(width - panelWidth - width * 0.04)
  const panelTop = Math.round(height - panelHeight - height * 0.05)
  const shoeLeft = Math.round(panelLeft + (panelWidth - shoeWidth) / 2)
  const shoeTop = Math.round(panelTop + panelHeight * 0.22)

  await baseImage
    .composite([
      {
        input: panelShadow,
        left: panelLeft,
        top: panelTop + 10,
        blend: 'multiply',
        opacity: 0.22,
      },
      {
        input: panelBase,
        left: panelLeft,
        top: panelTop,
      },
      {
        input: shoeShadow,
        left: shoeLeft,
        top: shoeTop + 8,
        blend: 'multiply',
        opacity: 0.24,
      },
      {
        input: shoeLayer,
        left: shoeLeft,
        top: shoeTop,
      },
      {
        input: panelOverlay,
        left: panelLeft,
        top: panelTop,
      },
    ])
    .webp({ quality: 92 })
    .toFile(outputPath)

  return `/uploads/${fileName}`
}
