import "../env.js";
import { S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.MINIO_ENDPOINT || "localhost";
const port = process.env.MINIO_PORT || "9010";
const useSsl = process.env.MINIO_USE_SSL === "true";
const protocol = useSsl ? "https" : "http";

export const storageBucket = process.env.MINIO_BUCKET || "junkmail";

const publicBaseUrl = process.env.MINIO_PUBLIC_URL || `${protocol}://${endpoint}:${port}`;

export const s3Client = new S3Client({
  region: process.env.MINIO_REGION || "us-east-1",
  endpoint: `${protocol}://${endpoint}:${port}`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || "minio",
    secretAccessKey: process.env.MINIO_SECRET_KEY || "minio123",
  },
});

export const publicObjectUrl = (key: string) => `${publicBaseUrl}/${storageBucket}/${key}`;
