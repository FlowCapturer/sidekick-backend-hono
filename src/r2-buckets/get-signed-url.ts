import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSingletonCacheInstance } from "../utils/local-cache.js";
import { Bindings } from "../types.js";
import { getR2Client } from "./r2-client.js";

let urlLocalCache: any;

export async function getR2SignedFileUrl(
  env: Bindings,
  key: string,
  expiresIn = 300,
): Promise<string> {
  if (!urlLocalCache) {
    urlLocalCache = getSingletonCacheInstance("r2-signed-get-urls", 20);
  }

  const cachedUrl = await urlLocalCache.get(key);
  if (cachedUrl) {
    return cachedUrl;
  }

  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET!,
    Key: key,
  });

  const signedUrl = await getSignedUrl(getR2Client(env), command, {
    expiresIn,
  });

  await urlLocalCache.set(key, signedUrl, expiresIn); // Use the expiresIn parameter for cache expiration
  return signedUrl;
}
