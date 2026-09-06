import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

import { AppError } from "@/lib/services/error_service"

const BUCKET = process.env.GARAGE_DEFAULT_BUCKET ?? "kbis-documents"
const PREFIX = "featured-partners"

const featuredPartnerS3Client = new S3Client({
  endpoint: "http://garage:3900",
  region: "garage",
  credentials: {
    accessKeyId: process.env.GARAGE_DEFAULT_ACCESS_KEY!,
    secretAccessKey: process.env.GARAGE_DEFAULT_SECRET_KEY!,
  },
  forcePathStyle: true,
})

export async function saveFeaturedPartnerImage(image: File): Promise<string> {
  const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg"
  const imageKey = `${PREFIX}/${crypto.randomUUID()}.${extension}`

  try {
    await featuredPartnerS3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: imageKey,
      Body: Buffer.from(await image.arrayBuffer()),
      ContentType: image.type,
      CacheControl: "public, max-age=3600",
    }))
  } catch (error) {
    console.error("Featured partner image upload failed", error)
    throw new AppError("Image storage temporarily unavailable", 503)
  }

  return imageKey
}

export async function readFeaturedPartnerImage(imageKey: string) {
  if (!imageKey.startsWith(`${PREFIX}/`)) {
    throw new AppError("Invalid image key", 400)
  }

  try {
    const response = await featuredPartnerS3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: imageKey }))
    if (!response.Body) return null

    return {
      bytes: await response.Body.transformToByteArray(),
      contentType: response.ContentType ?? "image/jpeg",
      cacheControl: response.CacheControl ?? "public, max-age=3600",
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : ""
    if (name === "NoSuchKey" || name === "NotFound") return null
    console.error("Featured partner image read failed", error)
    throw new AppError("Image storage temporarily unavailable", 503)
  }
}
