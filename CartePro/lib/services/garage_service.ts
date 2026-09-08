import { randomUUID } from "crypto";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { s3Client, DEFAULT_BUCKET } from "@/lib/services/s3_client";

interface UploadOptions {
  bucket?: string;
  contentType?: string;
  extension?: string;
}

interface UploadResult {
  key: string;
  bucket: string;
}

/**
 * Upload a file to Garage. Returns the key and bucket where the file was stored. Throws if the upload fails.
 */
export async function uploadFile(fileBuffer: Buffer, options: UploadOptions = {}): Promise<UploadResult>
{
  const bucket = options.bucket || DEFAULT_BUCKET;
  const uuid = randomUUID();
  const key = options.extension ? `${uuid}.${options.extension}` : uuid;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: options.contentType || "application/octet-stream",
    })
  );

  return { key, bucket };
}

/**
 * Get a file from Garage as a Buffer. Throws if the file does not exist.
 */
export async function getFile(key: string, bucket: string = DEFAULT_BUCKET): Promise<Buffer>
{
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const stream = response.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

/**
 * Delete a file from Garage.
 */
export async function deleteFile(key: string, bucket: string = DEFAULT_BUCKET): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}
