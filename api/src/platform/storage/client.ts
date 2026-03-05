import { S3Client } from "@aws-sdk/client-s3";
import { env, getEnv } from "../../env.js";

getEnv();

const endpoint = env.MINIO_ENDPOINT ?? "localhost";
const port = String(env.MINIO_PORT ?? 9010);
const useSsl = env.MINIO_USE_SSL ?? false;
const protocol = useSsl ? "https" : "http";

export const storageBucket = env.MINIO_BUCKET ?? "junkmail";

const publicBaseUrl = env.MINIO_PUBLIC_URL ?? `${protocol}://${endpoint}:${port}`;

export const s3Client = new S3Client({
  region: env.MINIO_REGION ?? "us-east-1",
  endpoint: `${protocol}://${endpoint}:${port}`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY ?? "minio",
    secretAccessKey: env.MINIO_SECRET_KEY ?? "minio123",
  },
});

export const publicObjectUrl = (key: string) => `${publicBaseUrl}/${storageBucket}/${key}`;
