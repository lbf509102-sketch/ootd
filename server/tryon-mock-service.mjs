import path from 'node:path'
import sharp from 'sharp'

function svgOverlay(width, height, garmentName) {
  const safeName = String(garmentName ?? '试穿单品')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(28,38,38,0)" />
          <stop offset="100%" stop-color="rgba(28,38,38,0.72)" />
        </linearGradient>
      </defs>
      <rect x="0" y="${height - 240}" width="${width}" height="240" fill="url(#fade)" />
      <rect x="28" y="28" width="220" height="44" rx="22" fill="rgba(255,248,240,0.88)" />
      <text x="48" y="56" font-size="24" font-family="Arial, sans-serif" fill="#213131">Mock Try-On</text>
      <rect x="28" y="${height - 172}" width="${width - 56}" height="116" rx="28" fill="rgba(255,248,240,0.9)" />
      <text x="52" y="${height - 124}" font-size="30" font-family="Arial, sans-serif" fill="#213131">试穿预览素材已准备</text>
      <text x="52" y="${height - 82}" font-size="22" font-family="Arial, sans-serif" fill="#5f675f">当前单品：${safeName}</text>
    </svg>
  `)
}

function uploadPathFromUrl(uploadsDir, imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) {
    throw new Error('Invalid upload path.')
  }
  return path.join(uploadsDir, imageUrl.slice('/uploads/'.length))
}

export async function createMockTryOnPreview({
  uploadsDir,
  personImageUrl,
  garmentImageUrl,
  garmentName,
  phone,
  sessionId,
}) {
  const width = 900
  const height = 1200
  const personPath = uploadPathFromUrl(uploadsDir, personImageUrl)
  const garmentPath = uploadPathFromUrl(uploadsDir, garmentImageUrl)
  const fileName = `${phone}-${Date.now()}-${sessionId}-tryon-mock.webp`
  const outputPath = path.join(uploadsDir, fileName)

  const personLayer = await sharp(personPath)
    .rotate()
    .resize(width, height, {
      fit: 'cover',
      position: 'centre',
    })
    .webp({ quality: 88 })
    .toBuffer()

  const garmentLayer = await sharp(garmentPath)
    .rotate()
    .resize(290, 360, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer()

  const garmentCard = await sharp({
    create: {
      width: 330,
      height: 420,
      channels: 4,
      background: { r: 255, g: 248, b: 240, alpha: 0.92 },
    },
  })
    .composite([
      {
        input: garmentLayer,
        left: 20,
        top: 24,
      },
    ])
    .png()
    .toBuffer()

  await sharp(personLayer)
    .composite([
      {
        input: garmentCard,
        top: 120,
        left: width - 362,
      },
      {
        input: svgOverlay(width, height, garmentName),
        top: 0,
        left: 0,
      },
    ])
    .webp({ quality: 88 })
    .toFile(outputPath)

  return `/uploads/${fileName}`
}
