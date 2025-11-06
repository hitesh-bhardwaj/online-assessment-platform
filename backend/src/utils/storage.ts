import fs from 'fs/promises';
import path from 'path';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL,
  PROCTORING_MEDIA_DIR,
} = process.env;

const localMediaRoot = PROCTORING_MEDIA_DIR
  ? path.resolve(PROCTORING_MEDIA_DIR)
  : path.join(process.cwd(), 'proctoring-media');

let r2Client: S3Client | null = null;

if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

export type StorageResult =
  | { storage: 'r2'; fileKey: string; publicUrl?: string }
  | { storage: 'local'; filePath: string };

export const isR2Enabled = () => Boolean(r2Client);

export const storeProctoringSegment = async (
  resultId: string,
  segmentId: string,
  buffer: Buffer,
  contentType: string,
): Promise<StorageResult> => {
  if (r2Client && R2_BUCKET) {
    const key = `proctoring/${resultId}/${segmentId}`;

    console.log(`[Storage] Uploading to R2: bucket=${R2_BUCKET}, key=${key}, size=${buffer.length}`);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const publicUrl = R2_PUBLIC_BASE_URL
      ? `${R2_PUBLIC_BASE_URL.replace(/\/+$/, '')}/${key}`
      : undefined;

    const result: StorageResult = {
      storage: 'r2',
      fileKey: key,
      publicUrl,
    };

    console.log(`[Storage] R2 upload successful: publicUrl=${publicUrl || 'none'}`);

    return result;
  }

  console.log(`[Storage] Using local storage: path=${localMediaRoot}, resultId=${resultId}`);

  const directory = path.join(localMediaRoot, resultId);
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, segmentId);
  await fs.writeFile(filePath, buffer);

  const result: StorageResult = {
    storage: 'local',
    filePath,
  };

  console.log(`[Storage] Local storage successful: filePath=${filePath}`);

  return result;
};

export const getLocalMediaRoot = () => localMediaRoot;

export const fetchProctoringSegment = async (key: string, range?: string) => {
  if (!r2Client || !R2_BUCKET) {
    return null;
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ...(range ? { Range: range } : {}),
  });

  return r2Client.send(command);
};

/**
 * Upload merged recording to R2
 * Returns the public URL or null if R2 is not configured
 */
export const uploadMergedRecording = async (
  resultId: string,
  type: 'webcam' | 'screen',
  filePath: string,
): Promise<{ publicUrl: string; fileKey: string } | null> => {
  if (!r2Client || !R2_BUCKET) {
    console.log('[Storage] R2 not configured, skipping upload');
    return null;
  }

  try {
    const fileName = `${type}-merged.webm`;
    const key = `proctoring/${resultId}/${fileName}`;

    console.log(`[Storage] Reading merged file: ${filePath}`);
    const fileBuffer = await fs.readFile(filePath);

    console.log(`[Storage] Uploading merged ${type} to R2: bucket=${R2_BUCKET}, key=${key}, size=${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: 'video/webm',
      }),
    );

    const publicUrl = R2_PUBLIC_BASE_URL
      ? `${R2_PUBLIC_BASE_URL.replace(/\/+$/, '')}/${key}`
      : key;

    console.log(`[Storage] ✅ Merged ${type} uploaded to R2: ${publicUrl}`);

    return { publicUrl, fileKey: key };
  } catch (error) {
    console.error(`[Storage] ❌ Failed to upload merged ${type} to R2:`, error);
    return null;
  }
};

