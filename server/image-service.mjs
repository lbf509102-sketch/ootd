import { mkdirSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { enhanceGarmentImageWithAi } from './garment-cutout-ai-service.mjs'

export function ensureUploadDir(dir) {
  mkdirSync(dir, { recursive: true })
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function colorDistance(a, b) {
  const red = a[0] - b[0]
  const green = a[1] - b[1]
  const blue = a[2] - b[2]
  return Math.sqrt(red * red + green * green + blue * blue)
}

function buildEdgeStrengthMap(data, width, height) {
  const edgeMap = new Uint16Array(width * height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const currentColor = [data[index], data[index + 1], data[index + 2]]
      let strongestEdge = 0

      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
        [x - 1, y - 1],
        [x + 1, y - 1],
        [x - 1, y + 1],
        [x + 1, y + 1],
      ]

      for (const [nextX, nextY] of neighbors) {
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
        const nextIndex = (nextY * width + nextX) * 4
        const nextColor = [data[nextIndex], data[nextIndex + 1], data[nextIndex + 2]]
        strongestEdge = Math.max(strongestEdge, colorDistance(currentColor, nextColor))
      }

      edgeMap[y * width + x] = Math.round(strongestEdge)
    }
  }

  return edgeMap
}

function buildBackgroundSample(data, width, height) {
  const samples = []
  const xStep = Math.max(1, Math.floor(width / 18))
  const yStep = Math.max(1, Math.floor(height / 18))

  for (let x = 0; x < width; x += xStep) {
    samples.push([data[x * 4], data[x * 4 + 1], data[x * 4 + 2]])
    const bottom = ((height - 1) * width + x) * 4
    samples.push([data[bottom], data[bottom + 1], data[bottom + 2]])
  }

  for (let y = 0; y < height; y += yStep) {
    const left = y * width * 4
    const right = (y * width + (width - 1)) * 4
    samples.push([data[left], data[left + 1], data[left + 2]])
    samples.push([data[right], data[right + 1], data[right + 2]])
  }

  if (!samples.length) {
    return [245, 240, 236]
  }

  return [
    Math.round(samples.reduce((sum, color) => sum + color[0], 0) / samples.length),
    Math.round(samples.reduce((sum, color) => sum + color[1], 0) / samples.length),
    Math.round(samples.reduce((sum, color) => sum + color[2], 0) / samples.length),
  ]
}

function buildBackgroundMask(data, width, height, background, edgeMap, closeThreshold, farThreshold) {
  const visited = new Uint8Array(width * height)
  const queue = []
  const edgeSeedThreshold = farThreshold + 10
  const neighborThreshold = Number(process.env.SUBJECT_NEIGHBOR_THRESHOLD ?? 26)
  const edgeSoftThreshold = Number(process.env.SUBJECT_EDGE_SOFT_THRESHOLD ?? 14)
  const edgeHardThreshold = Number(process.env.SUBJECT_EDGE_HARD_THRESHOLD ?? 28)

  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const offset = y * width + x
    if (visited[offset]) return
    visited[offset] = 1
    queue.push([x, y])
  }

  for (let x = 0; x < width; x += 1) {
    const topIndex = x * 4
    const bottomIndex = ((height - 1) * width + x) * 4
    const topColor = [data[topIndex], data[topIndex + 1], data[topIndex + 2]]
    const bottomColor = [data[bottomIndex], data[bottomIndex + 1], data[bottomIndex + 2]]
    if (colorDistance(topColor, background) <= edgeSeedThreshold && edgeMap[x] <= edgeSoftThreshold) enqueue(x, 0)
    if (
      colorDistance(bottomColor, background) <= edgeSeedThreshold &&
      edgeMap[(height - 1) * width + x] <= edgeSoftThreshold
    ) {
      enqueue(x, height - 1)
    }
  }

  for (let y = 0; y < height; y += 1) {
    const leftIndex = y * width * 4
    const rightIndex = (y * width + (width - 1)) * 4
    const leftColor = [data[leftIndex], data[leftIndex + 1], data[leftIndex + 2]]
    const rightColor = [data[rightIndex], data[rightIndex + 1], data[rightIndex + 2]]
    if (colorDistance(leftColor, background) <= edgeSeedThreshold && edgeMap[y * width] <= edgeSoftThreshold) enqueue(0, y)
    if (
      colorDistance(rightColor, background) <= edgeSeedThreshold &&
      edgeMap[y * width + (width - 1)] <= edgeSoftThreshold
    ) {
      enqueue(width - 1, y)
    }
  }

  while (queue.length) {
    const [x, y] = queue.shift()
    const currentIndex = (y * width + x) * 4
    const currentColor = [data[currentIndex], data[currentIndex + 1], data[currentIndex + 2]]

    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]

    for (const [nextX, nextY] of neighbors) {
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
      const offset = nextY * width + nextX
      if (visited[offset]) continue

      const nextIndex = offset * 4
      const nextColor = [data[nextIndex], data[nextIndex + 1], data[nextIndex + 2]]
      const distanceToBackground = colorDistance(nextColor, background)
      const distanceToCurrent = colorDistance(nextColor, currentColor)
      const edgeStrength = edgeMap[offset]

      const isSoftBackground = distanceToBackground <= closeThreshold && edgeStrength <= edgeSoftThreshold
      const isConnectedBackground =
        distanceToBackground <= farThreshold + 10 &&
        distanceToCurrent <= neighborThreshold &&
        edgeStrength <= edgeHardThreshold

      if (isSoftBackground || isConnectedBackground) {
        visited[offset] = 1
        queue.push([nextX, nextY])
      }
    }
  }

  return visited
}

function findSubjectBounds(data, width, height, alphaThreshold = 24) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha <= alphaThreshold) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0 || maxY < 0) return null

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

function countForegroundComponents(data, width, height, alphaThreshold = 24) {
  const visited = new Uint8Array(width * height)
  const minPixels = Math.max(320, Math.round(width * height * 0.004))
  const componentSizes = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * width + x
      if (visited[offset]) continue
      visited[offset] = 1
      const alpha = data[offset * 4 + 3]
      if (alpha <= alphaThreshold) continue

      const queue = [[x, y]]
      let pixels = 0

      while (queue.length) {
        const [currentX, currentY] = queue.shift()
        const currentOffset = currentY * width + currentX
        const currentAlpha = data[currentOffset * 4 + 3]
        if (currentAlpha <= alphaThreshold) continue
        pixels += 1

        const neighbors = [
          [currentX - 1, currentY],
          [currentX + 1, currentY],
          [currentX, currentY - 1],
          [currentX, currentY + 1],
          [currentX - 1, currentY - 1],
          [currentX + 1, currentY - 1],
          [currentX - 1, currentY + 1],
          [currentX + 1, currentY + 1],
        ]

        for (const [nextX, nextY] of neighbors) {
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
          const nextOffset = nextY * width + nextX
          if (visited[nextOffset]) continue
          visited[nextOffset] = 1
          if (data[nextOffset * 4 + 3] > alphaThreshold) {
            queue.push([nextX, nextY])
          }
        }
      }

      if (pixels >= minPixels) {
        componentSizes.push(pixels)
      }
    }
  }

  if (!componentSizes.length) return 0

  const largestComponent = Math.max(...componentSizes)
  const majorComponentThreshold = Math.max(minPixels, Math.round(largestComponent * 0.35))

  return componentSizes.filter((pixels) => pixels >= majorComponentThreshold).length
}

function countForegroundPixels(data, width, height, alphaThreshold = 24) {
  let pixels = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > alphaThreshold) pixels += 1
    }
  }

  return pixels
}

function solidifyDominantForeground(data, width, height, alphaThreshold = 48, edgeAlphaThreshold = 20) {
  const visited = new Uint8Array(width * height)
  let dominantPixels = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * width + x
      if (visited[offset]) continue
      visited[offset] = 1

      if (data[offset * 4 + 3] <= alphaThreshold) continue

      const queue = [[x, y]]
      const component = []

      while (queue.length) {
        const [currentX, currentY] = queue.shift()
        const currentOffset = currentY * width + currentX
        if (data[currentOffset * 4 + 3] <= alphaThreshold) continue
        component.push(currentOffset)

        const neighbors = [
          [currentX - 1, currentY],
          [currentX + 1, currentY],
          [currentX, currentY - 1],
          [currentX, currentY + 1],
          [currentX - 1, currentY - 1],
          [currentX + 1, currentY - 1],
          [currentX - 1, currentY + 1],
          [currentX + 1, currentY + 1],
        ]

        for (const [nextX, nextY] of neighbors) {
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
          const nextOffset = nextY * width + nextX
          if (visited[nextOffset]) continue
          visited[nextOffset] = 1
          if (data[nextOffset * 4 + 3] > alphaThreshold) {
            queue.push([nextX, nextY])
          }
        }
      }

      if (component.length > dominantPixels.length) {
        dominantPixels = component
      }
    }
  }

  const dominantSet = new Uint8Array(width * height)
  for (const offset of dominantPixels) {
    dominantSet[offset] = 1
    data[offset * 4 + 3] = 255
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * width + x
      if (dominantSet[offset]) continue

      const alpha = data[offset * 4 + 3]
      if (alpha <= edgeAlphaThreshold) {
        data[offset * 4 + 3] = 0
      }
    }
  }
}

function isolateStudioSubject(rawResult, analysisResult = rawResult) {
  const { data, info } = rawResult
  const analysisData = analysisResult.data
  const { width, height } = info
  const background = buildBackgroundSample(analysisData, width, height)
  const edgeMap = buildEdgeStrengthMap(analysisData, width, height)
  const closeThreshold = Number(process.env.STUDIO_BG_CLOSE_THRESHOLD ?? 10)
  const farThreshold = Number(process.env.STUDIO_BG_FAR_THRESHOLD ?? 42)
  const edgeProtectThreshold = Number(process.env.STUDIO_EDGE_PROTECT_THRESHOLD ?? 12)
  const edgeHardThreshold = Number(process.env.STUDIO_EDGE_HARD_THRESHOLD ?? 24)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * width + x
      const index = (y * width + x) * 4
      const pixel = [analysisData[index], analysisData[index + 1], analysisData[index + 2]]
      const distance = colorDistance(pixel, background)
      const edgeStrength = edgeMap[offset]

      let alpha = 255
      if (distance <= closeThreshold) {
        alpha = 0
      } else if (distance < farThreshold) {
        alpha = clampChannel(((distance - closeThreshold) / Math.max(1, farThreshold - closeThreshold)) * 255)
      }

      if (edgeStrength >= edgeHardThreshold && distance >= closeThreshold - 2) {
        alpha = Math.max(alpha, 255)
      } else if (edgeStrength >= edgeProtectThreshold && distance >= closeThreshold) {
        alpha = Math.max(alpha, 224)
      }

      data[index + 3] = alpha
    }
  }

  solidifyDominantForeground(data, width, height, 56, 56)

  return {
    data,
    info,
    bounds: findSubjectBounds(data, width, height),
    foregroundPixels: countForegroundPixels(data, width, height),
    componentCount: countForegroundComponents(data, width, height),
  }
}

function isolateSubject(rawResult, analysisResult = rawResult) {
  const { data, info } = rawResult
  const analysisData = analysisResult.data
  const { width, height } = info
  const background = buildBackgroundSample(analysisData, width, height)
  const edgeMap = buildEdgeStrengthMap(analysisData, width, height)
  const closeThreshold = Number(process.env.SUBJECT_CLOSE_THRESHOLD ?? 30)
  const farThreshold = Number(process.env.SUBJECT_FAR_THRESHOLD ?? 68)
  const backgroundMask = buildBackgroundMask(analysisData, width, height, background, edgeMap, closeThreshold, farThreshold)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * width + x
      const index = offset * 4
      const pixel = [analysisData[index], analysisData[index + 1], analysisData[index + 2]]
      const distance = colorDistance(pixel, background)
      let alpha = backgroundMask[offset] ? 0 : 255

      if (!backgroundMask[offset] && distance < farThreshold) {
        alpha = clampChannel(((distance - closeThreshold) / Math.max(1, farThreshold - closeThreshold)) * 255)
      }

      data[index + 3] = alpha
    }
  }

  return {
    data,
    info,
    bounds: findSubjectBounds(data, width, height),
    foregroundPixels: countForegroundPixels(data, width, height),
    componentCount: countForegroundComponents(data, width, height),
  }
}

export async function processAndSaveImage({
  dataUrl,
  phone,
  uploadsDir,
  processingMode = 'standard',
}) {
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Please upload a valid image.')
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) {
    throw new Error('Unsupported image format.')
  }

  const base64 = match[2]
  const originalBuffer = Buffer.from(base64, 'base64')
  const fileName = `${phone}-${Date.now()}-${crypto.randomUUID()}.webp`
  const filePath = path.join(uploadsDir, fileName)
  const quality = Number(process.env.IMAGE_QUALITY ?? 82)
  const baseImage = sharp(originalBuffer).rotate().resize({
    width: 1200,
    height: 1200,
    fit: 'inside',
    withoutEnlargement: true,
  })

  if (processingMode === 'subject') {
    let workingImage = baseImage
    let subjectMethod = 'local'

    try {
      const aiEnhanced = await enhanceGarmentImageWithAi(dataUrl)
      if (aiEnhanced?.buffer) {
        workingImage = sharp(aiEnhanced.buffer).rotate().resize({
          width: 1200,
          height: 1200,
          fit: 'inside',
          withoutEnlargement: true,
        })
        subjectMethod = 'ai'
      }
    } catch {
      subjectMethod = 'local'
    }

    const rawResult = await workingImage.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const analysisResult = await workingImage.clone().blur(1.4).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const isolated = subjectMethod === 'ai' ? isolateStudioSubject(rawResult, analysisResult) : isolateSubject(rawResult, analysisResult)
    const minForegroundRatio = Number(process.env.SUBJECT_MIN_FOREGROUND_RATIO ?? 0.015)
    const minBoundsAreaRatio = Number(process.env.SUBJECT_MIN_BOUNDS_AREA_RATIO ?? 0.03)
    const minForegroundDensity =
      Number(subjectMethod === 'ai' ? process.env.STUDIO_MIN_FOREGROUND_DENSITY ?? 0.12 : process.env.SUBJECT_MIN_FOREGROUND_DENSITY ?? 0.22)
    const imageArea = isolated.info.width * isolated.info.height
    const foregroundRatio = imageArea > 0 ? isolated.foregroundPixels / imageArea : 0
    const boundsArea =
      isolated.bounds && isolated.bounds.width > 0 && isolated.bounds.height > 0
        ? isolated.bounds.width * isolated.bounds.height
        : 0
    const boundsAreaRatio = imageArea > 0 ? boundsArea / imageArea : 0
    const foregroundDensity = boundsArea > 0 ? isolated.foregroundPixels / boundsArea : 0
    const extractionLooksValid =
      Boolean(isolated.bounds) &&
      foregroundRatio >= minForegroundRatio &&
      boundsAreaRatio >= minBoundsAreaRatio &&
      foregroundDensity >= minForegroundDensity
    const subjectImage = sharp(isolated.data, {
      raw: {
        width: isolated.info.width,
        height: isolated.info.height,
        channels: isolated.info.channels,
      },
    })

    if (extractionLooksValid && isolated.bounds) {
      const padding = Number(process.env.SUBJECT_PADDING ?? 24)
      const left = Math.max(0, isolated.bounds.left - padding)
      const top = Math.max(0, isolated.bounds.top - padding)
      const width = Math.min(isolated.info.width - left, isolated.bounds.width + padding * 2)
      const height = Math.min(isolated.info.height - top, isolated.bounds.height + padding * 2)
      subjectImage.extract({ left, top, width, height })
    }

    if (extractionLooksValid) {
      await subjectImage
        .webp({
          quality,
          effort: 4,
          alphaQuality: 100,
        })
        .toFile(filePath)
    } else {
      await workingImage
        .clone()
        .webp({
          quality,
          effort: 4,
        })
        .toFile(filePath)
    }

    return {
      imageUrl: `/uploads/${fileName}`,
      processingMode,
      subjectStats: {
        extracted: extractionLooksValid,
        componentCount: isolated.componentCount,
        method: extractionLooksValid ? (subjectMethod === 'ai' ? 'ai_cutout' : 'local_cutout') : subjectMethod === 'ai' ? 'ai_studio_fallback' : 'fallback_original',
      },
    }
  } else {
    await baseImage
      .webp({
        quality,
        effort: 4,
      })
      .toFile(filePath)
  }

  return {
    imageUrl: `/uploads/${fileName}`,
    processingMode,
    subjectStats: {
      extracted: false,
      componentCount: 0,
    },
  }
}

export async function saveGeneratedImageDataUrl({
  dataUrl,
  phone,
  uploadsDir,
}) {
  const result = await processAndSaveImage({
    dataUrl,
    phone,
    uploadsDir,
    processingMode: 'standard',
  })
  return result.imageUrl
}

export async function removeUploadedFile(uploadsDir, imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return
  const fileName = imageUrl.slice('/uploads/'.length)
  const filePath = path.join(uploadsDir, fileName)
  try {
    await unlink(filePath)
  } catch {
    // Best effort cleanup; missing files should not break deletion.
  }
}
