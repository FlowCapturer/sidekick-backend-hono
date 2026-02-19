import { PutObjectCommand } from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Bindings } from "../types.js";
import logger from "../utils/error-logger.js";
import { getR2Client } from "./r2-client.js";

export async function uploadToR2(
  env: Bindings,
  key: string,
  fileBuffer: Buffer | Uint8Array,
) {
  try {
    return await env.R2.put(key, fileBuffer);
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    logger.error(`R2 upload error: ${error.message}`, error);
    throw caught;
  }
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;

interface ISignedUploadUrlParams {
  env: Bindings;
  key: string;
  contentType: string;
  contentLength: number;
  allowedTypes?: string[];
  maxSizeMb?: number;
  expiresIn?: number;
}

export async function getR2SignedUploadUrl({
  env,
  key,
  contentType,
  contentLength,
  allowedTypes = ALLOWED_TYPES,
  maxSizeMb = MAX_SIZE_MB,
  expiresIn = 300,
}: ISignedUploadUrlParams) {
  if (!allowedTypes.includes(contentType)) {
    throw new Error("Invalid image type");
  }

  if (contentLength > maxSizeMb * 1024 * 1024) {
    throw new Error("File too large");
  }

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET!,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(getR2Client(env), command, {
    expiresIn, // 5 minutes
  });
}
