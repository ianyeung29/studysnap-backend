import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "studysnap-storage";

export const isR2Configured = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
);

let r2Client: S3Client | null = null;

if (isR2Configured) {
  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  console.log("☁️ Cloudflare R2 S3 Storage layer initialized.");
} else {
  console.warn("⚠️ Cloudflare R2 credentials missing. Storage fallback active.");
}

export function getR2Client(): S3Client {
  if (!r2Client) {
    throw new Error("Cloudflare R2 credentials are not configured in environment variables.");
  }
  return r2Client;
}

/**
 * Generate a presigned PUT URL for direct client-to-R2 upload (saves server memory/bandwidth)
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 3600
): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a secure presigned GET URL for downloading/viewing a private R2 object
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 86400 // 24 hours
): Promise<string> {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Upload a Buffer directly from the server (e.g. backend PDF generator output)
 */
export async function uploadBufferToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await client.send(command);
  
  // Return presigned GET URL
  return await getPresignedDownloadUrl(key);
}

/**
 * Delete an object from Cloudflare R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client();
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  await client.send(command);
}
