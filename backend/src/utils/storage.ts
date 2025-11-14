import fs from 'fs/promises';
import path from 'path';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const getLocalMediaRoot = () => {
  const PROCTORING_MEDIA_DIR = process.env.PROCTORING_MEDIA_DIR;
  return PROCTORING_MEDIA_DIR
    ? path.resolve(PROCTORING_MEDIA_DIR)
    : path.join(process.cwd(), 'proctoring-media');
};

let r2Client: S3Client | null = null;
let r2Initialized = false;

// Lazy initialization - create R2 client on first use (after dotenv loads)
const getR2Client = (): S3Client | null => {
  if (r2Initialized) {
    return r2Client;
  }

  r2Initialized = true;

  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
  } = process.env;

  // Debug: Log R2 configuration status
  console.log('[Storage] R2 Configuration Check:', {
    accountId: R2_ACCOUNT_ID ? `${R2_ACCOUNT_ID.slice(0, 8)}...` : 'NOT SET',
    accessKeyId: R2_ACCESS_KEY_ID ? `${R2_ACCESS_KEY_ID.slice(0, 8)}...` : 'NOT SET',
    secretKey: R2_SECRET_ACCESS_KEY ? '[HIDDEN]' : 'NOT SET',
    bucket: R2_BUCKET || 'NOT SET',
    publicUrl: process.env.R2_PUBLIC_BASE_URL || 'NOT SET'
  });

  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
    console.log('[Storage] ✅ R2 client initialized successfully');
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  } else {
    console.log('[Storage] ⚠️  R2 client NOT initialized - missing required environment variables');
    console.log('[Storage] Falling back to local file storage');
  }

  return r2Client;
}

export type StorageResult =
  | { storage: 'r2'; fileKey: string; publicUrl?: string }
  | { storage: 'local'; filePath: string };

export const isR2Enabled = () => Boolean(getR2Client());

export const storeProctoringSegment = async (
  resultId: string,
  segmentId: string,
  buffer: Buffer,
  contentType: string,
): Promise<StorageResult> => {
  const client = getR2Client();
  const R2_BUCKET = process.env.R2_BUCKET;

  if (client && R2_BUCKET) {
    const key = `proctoring/${resultId}/${segmentId}`;

    console.log(`[Storage] Uploading to R2: bucket=${R2_BUCKET}, key=${key}, size=${buffer.length}`);

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;
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

  const localMediaRoot = getLocalMediaRoot();
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

export { getLocalMediaRoot };

export const fetchProctoringSegment = async (key: string, range?: string) => {
  const client = getR2Client();
  const R2_BUCKET = process.env.R2_BUCKET;

  if (!client || !R2_BUCKET) {
    return null;
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ...(range ? { Range: range } : {}),
  });

  return client.send(command);
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
  const client = getR2Client();
  const R2_BUCKET = process.env.R2_BUCKET;

  if (!client || !R2_BUCKET) {
    console.log('[Storage] R2 not configured, skipping upload');
    return null;
  }

  try {
    const fileName = `${type}-merged.webm`;
    const key = `proctoring/${resultId}/${fileName}`;

    console.log(`[Storage] Reading merged file: ${filePath}`);
    const fileBuffer = await fs.readFile(filePath);

    console.log(`[Storage] Uploading merged ${type} to R2: bucket=${R2_BUCKET}, key=${key}, size=${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: 'video/webm',
      }),
    );

    const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;
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

