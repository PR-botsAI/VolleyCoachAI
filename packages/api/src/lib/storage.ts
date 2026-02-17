import { Storage } from "@google-cloud/storage";

function getStorageClient(): Storage {
  const credentialsJson = process.env.GCS_CREDENTIALS_JSON;
  if (credentialsJson) {
    const credentials = JSON.parse(credentialsJson);
    return new Storage({ credentials });
  }
  // Fall back to application default credentials
  return new Storage();
}

const storage = getStorageClient();

function getBucketName(): string {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME environment variable is required");
  }
  return bucketName;
}

/**
 * Generate a resumable upload URL for direct client-to-GCS uploads.
 * The client uses this URL to upload the file directly without proxying through the API.
 */
export async function generateResumableUploadUrl(
  filePath: string,
  mimeType: string,
  fileSize: number
): Promise<string> {
  const bucket = storage.bucket(getBucketName());
  const file = bucket.file(filePath);

  const [url] = await file.createResumableUpload({
    metadata: {
      contentType: mimeType,
    },
    origin: process.env.CORS_ORIGIN || "*",
  });

  return url;
}

/**
 * Get the public URL for a file stored in GCS.
 */
export function getPublicUrl(filePath: string): string {
  const bucketName = getBucketName();
  return `https://storage.googleapis.com/${bucketName}/${filePath}`;
}

/**
 * Get a signed URL for temporary access to a private file.
 */
export async function getSignedUrl(
  filePath: string,
  expirationMinutes: number = 60
): Promise<string> {
  const bucket = storage.bucket(getBucketName());
  const file = bucket.file(filePath);

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expirationMinutes * 60 * 1000,
  });

  return url;
}

/**
 * Delete a file from GCS.
 */
export async function deleteFile(filePath: string): Promise<void> {
  const bucket = storage.bucket(getBucketName());
  const file = bucket.file(filePath);

  try {
    await file.delete();
  } catch (err: unknown) {
    const error = err as { code?: number };
    // Ignore 404 errors (file already deleted)
    if (error.code === 404) {
      console.warn(`[Storage] File not found for deletion: ${filePath}`);
      return;
    }
    throw err;
  }
}

/**
 * Check if a file exists in GCS.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  const bucket = storage.bucket(getBucketName());
  const file = bucket.file(filePath);
  const [exists] = await file.exists();
  return exists;
}

export { storage };
