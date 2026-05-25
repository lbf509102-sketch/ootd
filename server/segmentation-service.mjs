import { Readable } from 'node:stream'
import sharp from 'sharp'
import ImagesegPackage, {
  SegmentClothAdvanceRequest,
  SegmentCommodityAdvanceRequest,
} from '@alicloud/imageseg20191230'

const ImagesegClient = ImagesegPackage?.default ?? ImagesegPackage

export function classifyAliyunSegmentationError(error) {
  const code = String(error?.code ?? '').trim()
  const message = String(error?.message ?? error ?? '').trim()

  if (!getAccessKeyId() || !getAccessKeySecret()) {
    return {
      code: 'missing_credentials',
      message: '还没有配置阿里云图像分割凭证。',
    }
  }

  if (code === 'InvalidApi.NotPurchase') {
    return {
      code: 'api_not_purchased',
      message: '阿里云图像分割接口还没有开通，所以当前不能自动抠图。',
    }
  }

  if (code === 'Unauthorized' || code === 'InvalidAccessKeyId.NotFound' || code === 'SignatureDoesNotMatch') {
    return {
      code: 'credentials_invalid',
      message: '阿里云图像分割凭证无效，当前不能自动抠图。',
    }
  }

  return {
    code: code || 'segmentation_failed',
    message: message || '阿里云图像分割调用失败。',
  }
}

function getAccessKeyId() {
  return process.env.ALIYUN_VIAPI_ACCESS_KEY_ID?.trim() || process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.trim() || ''
}

function getAccessKeySecret() {
  return process.env.ALIYUN_VIAPI_ACCESS_KEY_SECRET?.trim() || process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET?.trim() || ''
}

export function hasAliyunSegmentationCredentials() {
  return Boolean(getAccessKeyId() && getAccessKeySecret())
}

let cachedClient = null

function getAliyunSegmentationClient() {
  if (cachedClient) return cachedClient

  const accessKeyId = getAccessKeyId()
  const accessKeySecret = getAccessKeySecret()
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('Missing Alibaba Cloud AccessKey for image segmentation.')
  }

  cachedClient = new ImagesegClient({
    accessKeyId,
    accessKeySecret,
    regionId: process.env.ALIYUN_VIAPI_REGION_ID?.trim() || 'cn-shanghai',
  })

  return cachedClient
}

function mapClothClasses(categoryHint = '') {
  const category = String(categoryHint).trim().toLowerCase()
  if (category === 'top') return ['tops']
  if (category === 'outerwear') return ['coat']
  if (category === 'bottom') return ['pants', 'skirt']
  return []
}

function shouldUseClothSegmentation(categoryHint = '') {
  return mapClothClasses(categoryHint).length > 0
}

function extractSegmentationUrl(responseBody) {
  const clothElements = responseBody?.data?.elements
  if (Array.isArray(clothElements) && clothElements[0]?.imageURL) {
    return clothElements[0].imageURL
  }

  const commodityUrl = responseBody?.data?.imageURL
  if (typeof commodityUrl === 'string' && commodityUrl) {
    return commodityUrl
  }

  return ''
}

async function downloadImageBuffer(imageUrl) {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Failed to download segmentation result: ${response.status} ${errorText}`.trim())
  }

  return Buffer.from(await response.arrayBuffer())
}

async function normalizeSegmentationInput(buffer) {
  const image = sharp(buffer).rotate()
  const metadata = await image.metadata()
  const width = Number(metadata.width ?? 0)
  const height = Number(metadata.height ?? 0)
  const minEdge = Math.min(width || 0, height || 0)

  const pipeline =
    minEdge > 0 && minEdge < 512
      ? image.resize({
          width: width >= height ? 960 : null,
          height: height > width ? 960 : null,
          fit: 'inside',
          withoutEnlargement: false,
        })
      : image

  return pipeline.png().toBuffer()
}

export async function segmentProductImageWithAliyun({ buffer, categoryHint = '' }) {
  const client = getAliyunSegmentationClient()
  const runtime = {}
  const normalizedBuffer = await normalizeSegmentationInput(buffer)
  let response

  if (shouldUseClothSegmentation(categoryHint)) {
    response = await client.segmentClothAdvance(
      new SegmentClothAdvanceRequest({
        imageURLObject: Readable.from(normalizedBuffer),
        clothClass: mapClothClasses(categoryHint),
        outMode: 1,
        returnForm: 'crop',
      }),
      runtime,
    )
  } else {
    response = await client.segmentCommodityAdvance(
      new SegmentCommodityAdvanceRequest({
        imageURLObject: Readable.from(normalizedBuffer),
        returnForm: 'crop',
      }),
      runtime,
    )
  }

  const imageUrl = extractSegmentationUrl(response?.body)
  if (!imageUrl) {
    throw new Error('Alibaba segmentation returned no image URL.')
  }

  const resultBuffer = await downloadImageBuffer(imageUrl)
  return {
    buffer: resultBuffer,
    source: shouldUseClothSegmentation(categoryHint) ? 'aliyun_cloth' : 'aliyun_commodity',
  }
}
