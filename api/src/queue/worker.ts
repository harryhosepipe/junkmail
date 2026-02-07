import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { Worker } from "bullmq";
import sharp from "sharp";
import { db } from "../db/client.js";
import { images } from "../db/schema.js";
import { mutateConvexRecordVote } from "../convex/client.js";
import { publicObjectUrl, s3Client, storageBucket } from "../storage/client.js";
import { ImageFormat, ImageSize, variantKey } from "../storage/paths.js";
import { redis } from "./connection.js";

const sizes: Record<ImageSize, number> = {
  thumb: 320,
  feed: 960,
  full: 1600
};

const toBuffer = async (body: unknown) => {
  if (!body || typeof body !== "object") {
    throw new Error("Missing object body");
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

const worker = new Worker(
  "image-processing",
  async (job) => {
    const { imageId, key, ext, contentType } = job.data as {
      imageId: string;
      key: string;
      ext: "jpg" | "png";
      contentType: string;
    };

    const original = await s3Client.send(
      new GetObjectCommand({
        Bucket: storageBucket,
        Key: key
      })
    );

    const originalBuffer = await toBuffer(original.Body);
    const fallbackFormat: ImageFormat = ext === "png" ? "png" : "jpg";

    const variantUrls: Record<string, Record<string, string | number>> = {};

    for (const size of Object.keys(sizes) as ImageSize[]) {
      const width = sizes[size];
      const resized = sharp(originalBuffer).resize({ width, withoutEnlargement: true });

      const avifBuffer = await resized.clone().avif({ quality: 60 }).toBuffer();
      const webpBuffer = await resized.clone().webp({ quality: 70 }).toBuffer();

      const fallbackBuffer =
        fallbackFormat === "png"
          ? await resized.clone().png({ compressionLevel: 9 }).toBuffer()
          : await resized.clone().jpeg({ quality: 80 }).toBuffer();

      const avifKey = variantKey(imageId, size, "avif");
      const webpKey = variantKey(imageId, size, "webp");
      const fallbackKey = variantKey(imageId, size, fallbackFormat);

      await s3Client.send(
        new PutObjectCommand({
          Bucket: storageBucket,
          Key: avifKey,
          Body: avifBuffer,
          ContentType: "image/avif"
        })
      );

      await s3Client.send(
        new PutObjectCommand({
          Bucket: storageBucket,
          Key: webpKey,
          Body: webpBuffer,
          ContentType: "image/webp"
        })
      );

      await s3Client.send(
        new PutObjectCommand({
          Bucket: storageBucket,
          Key: fallbackKey,
          Body: fallbackBuffer,
          ContentType: contentType
        })
      );

      variantUrls[size] = {
        width,
        avif: publicObjectUrl(avifKey),
        webp: publicObjectUrl(webpKey),
        [fallbackFormat]: publicObjectUrl(fallbackKey)
      };
    }

    await db
      .update(images)
      .set({ status: "public", variantUrls })
      .where(eq(images.id, imageId));
  },
  {
    connection: redis
  }
);

worker.on("failed", (job, err) => {
  const id = job?.id ?? "unknown";
  console.error(`[queue] image-processing job failed`, id, err);
});

const voteWorker = new Worker(
  "vote-writes",
  async (job) => {
    const { imageAId, imageBId, winnerId, voterHash, ipHash, createdAt } = job.data as {
      imageAId: string;
      imageBId: string;
      winnerId: string;
      voterHash: string;
      ipHash: string;
      createdAt: number;
    };

    await mutateConvexRecordVote({
      imageAId,
      imageBId,
      winnerId,
      voterHash,
      ipHash,
      createdAt,
    });
  },
  {
    connection: redis,
    concurrency: 1,
  },
);

voteWorker.on("failed", (job, err) => {
  const id = job?.id ?? "unknown";
  console.error(`[queue] vote-writes job failed`, id, err);
});
