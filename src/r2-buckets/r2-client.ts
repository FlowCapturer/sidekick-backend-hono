import { S3Client } from "@aws-sdk/client-s3";
import { Bindings } from "../types.js";

let r2Client: S3Client;

export const getR2Client = (env: Bindings): S3Client => {
  if (r2Client) {
    return r2Client;
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY!,
      secretAccessKey: env.R2_SECRET_KEY!,
    },
  });

  return r2Client;
};
