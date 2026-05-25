import path from 'node:path'
import sharp from 'sharp'

function escapeSvgText(value) {
  return String(value ?? 'Preview item')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function uploadPathFromUrl(uploadsDir, imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) {
    throw new Error('Invalid upload path.')
  }
  return path.join(uploadsDir, imageUrl.slice('/uploads/'.length))
}

function getGarmentFrame(category) {
  if (category === 'dress') {
    return { width: 300, height: 520 }
  }
  if (category === 'bottom') {
    return { width: 280, height: 420 }
  }
  if (category === 'shoes') {
    return { width: 300, height: 180 }
  }
  return { width: 300, height: 360 }
}

function buildOverlaySvg({ width, height, garmentName, garmentCategory }) {
  const safeName = escapeSvgText(garmentName)
  const safeCategory = escapeSvgText(String(garmentCategory || 'preview').toUpperCase())

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(21, 28, 29, 0.08)" />
          <stop offset="100%" stop-color="rgba(21, 28, 29, 0.78)" />
        </linearGradient>
        <linearGradient id="panelGlow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255, 248, 241, 0.96)" />
          <stop offset="100%" stop-color="rgba(245, 235, 226, 0.90)" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#heroFade)" />

      <rect x="52" y="52" width="182" height="46" rx="23" fill="rgba(255,248,241,0.92)" />
      <text x="80" y="82" font-size="24" font-family="Arial, sans-serif" fill="#233233">Preview</text>

      <rect x="${width - 380}" y="84" width="292" height="40" rx="20" fill="rgba(255,255,255,0.14)" />
      <text x="${width - 348}" y="110" font-size="18" font-family="Arial, sans-serif" fill="rgba(255,255,255,0.92)">Mock showcase only</text>

      <rect x="${width - 392}" y="182" width="320" height="612" rx="36" fill="rgba(255,248,241,0.90)" />
      <rect x="${width - 360}" y="214" width="110" height="34" rx="17" fill="#e2a16b" />
      <text x="${width - 332}" y="237" font-size="16" font-family="Arial, sans-serif" fill="#fffaf4">${safeCategory}</text>

      <rect x="44" y="${height - 266}" width="${width - 88}" height="202" rx="34" fill="url(#panelGlow)" />
      <text x="82" y="${height - 190}" font-size="44" font-family="Arial, sans-serif" font-weight="700" fill="#233233">${safeName}</text>
      <text x="82" y="${height - 138}" font-size="24" font-family="Arial, sans-serif" fill="#556261">
        Demo layout for client walkthrough. Real try-on should come from AI provider output.
      </text>
      <text x="82" y="${height - 96}" font-size="22" font-family="Arial, sans-serif" fill="#7a8482">
        This fallback keeps the person photo and garment visible without placing the clothes over the face.
      </text>
    </svg>
  `)
}

export async function createMockTryOnPreview({
  uploadsDir,
  personImageUrl,
  garmentImageUrl,
  garmentName,
  garmentCategory = 'top',
  phone,
  sessionId,
}) {
  const width = 1200
  const height = 1400
  const personPath = uploadPathFromUrl(uploadsDir, personImageUrl)
  const garmentPath = uploadPathFromUrl(uploadsDir, garmentImageUrl)
  const fileName = `${phone}-${Date.now()}-${sessionId}-tryon-mock.webp`
  const outputPath = path.join(uploadsDir, fileName)
  const garmentFrame = getGarmentFrame(garmentCategory)

  const backgroundLayer = await sharp(personPath)
    .rotate()
    .resize(width, height, {
      fit: 'cover',
      position: 'centre',
    })
    .blur(18)
    .modulate({ brightness: 0.92, saturation: 0.9 })
    .webp({ quality: 84 })
    .toBuffer()

  const personLayer = await sharp(personPath)
    .rotate()
    .resize(560, 980, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const personShadow = await sharp(personLayer)
    .blur(16)
    .modulate({ brightness: 0.4, saturation: 0.4 })
    .png()
    .toBuffer()

  const garmentLayer = await sharp(garmentPath)
    .rotate()
    .resize(garmentFrame.width, garmentFrame.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const garmentShadow = await sharp(garmentLayer)
    .blur(12)
    .modulate({ brightness: 0.5, saturation: 0.45 })
    .png()
    .toBuffer()

  const panelBase = await sharp({
    create: {
      width: 320,
      height: 612,
      channels: 4,
      background: { r: 255, g: 248, b: 241, alpha: 0.92 },
    },
  })
    .png()
    .toBuffer()

  const panelGlow = await sharp(panelBase)
    .blur(18)
    .modulate({ brightness: 0.84, saturation: 0.9 })
    .png()
    .toBuffer()

  await sharp(backgroundLayer)
    .composite([
      {
        input: personShadow,
        left: 132,
        top: 164,
        blend: 'multiply',
        opacity: 0.32,
      },
      {
        input: personLayer,
        left: 116,
        top: 140,
      },
      {
        input: panelGlow,
        left: 826,
        top: 196,
        blend: 'multiply',
        opacity: 0.24,
      },
      {
        input: panelBase,
        left: 808,
        top: 182,
      },
      {
        input: garmentShadow,
        left: Math.round(808 + (320 - garmentFrame.width) / 2) + 8,
        top: Math.round(256 + (430 - garmentFrame.height) / 2) + 12,
        blend: 'multiply',
        opacity: 0.26,
      },
      {
        input: garmentLayer,
        left: Math.round(808 + (320 - garmentFrame.width) / 2),
        top: Math.round(256 + (430 - garmentFrame.height) / 2),
      },
      {
        input: buildOverlaySvg({ width, height, garmentName, garmentCategory }),
        top: 0,
        left: 0,
      },
    ])
    .webp({ quality: 86 })
    .toFile(outputPath)

  return `/uploads/${fileName}`
}
